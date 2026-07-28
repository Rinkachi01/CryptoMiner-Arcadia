import { env } from "cloudflare:workers";
import {
  claimOrVerifyAdminOwner,
  ensureAdminSchema,
  readAdminRuntimeSettings,
  updateAdminAlertThreshold,
  updateAdminRuntimeSetting,
  writeAdminAudit,
  type AdminSettingKey,
  type AdminThresholdKey,
} from "../../admin-settings";
import { evaluateAdminAlerts } from "../../admin-alert-rules";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getMiner, type PoolId } from "../../game-rules";
import type { PublicGameState } from "../../game-server";
import {
  DEFAULT_NETWORK_BASE_POWER,
  ZERO_NETWORK_POWER,
  readNetworkPowerSnapshot,
  updateBlockRewardBonus,
  updateBlockRewards,
  updateNetworkBasePower,
} from "../../network-server";
import {
  closeActiveSeason,
  createSeason,
  createSeasonSnapshot,
  ensureDefaultSeason,
  readSeasonOverview,
} from "../../season-server";

export const dynamic = "force-dynamic";

type CountRow = {
  total: number;
};

type SessionMetricRow = {
  games: number;
  power: number;
  wins: number;
};

type SuspiciousSessionRow = {
  account_id: string;
  completed_at: number | null;
  difficulty: number;
  display_name: string | null;
  email: string | null;
  game_id: string;
  id: string;
  review_note: string | null;
  review_resolution: string | null;
  review_reason: string | null;
  reviewed_at: number | null;
  risk_level: string;
  score: number | null;
  started_at: number;
  status: string;
};

type GameBreakdownRow = {
  game_id: string;
  plays: number;
  power: number;
  wins: number;
};

type LedgerSummaryRow = {
  action: string;
  count: number;
  cma_delta_micros: number;
};

type LedgerRow = {
  action: string;
  created_at: number;
  display_name: string | null;
  email: string | null;
  id: string;
  metadata_json: string;
};

type StateRow = {
  state_json: string;
};

type OwnerStateRow = StateRow & {
  version: number;
};

type AuditRow = {
  action: string;
  created_at: number;
  metadata_json: string;
};

const adminSettingKeys: AdminSettingKey[] = [
  "cratesEnabled",
  "dailyBatteryEnabled",
  "minigamePowerEnabled",
];

const OWNER_TEST_BALANCE_CMA = 10_000;
const blockRewardBounds: Record<
  PoolId,
  { maximum: number; minimum: number }
> = {
  cma: { minimum: 1_000, maximum: 50_000 },
  btc: { minimum: 1, maximum: 100 },
  doge: { minimum: 100_000, maximum: 10_000_000 },
};

const adminThresholdBounds: Record<
  AdminThresholdKey,
  { maximum: number; minimum: number }
> = {
  crateAlertCount: { minimum: 1, maximum: 1_000 },
  minerConcentrationAlertPercent: { minimum: 5, maximum: 100 },
  openReviewAlertCount: { minimum: 1, maximum: 500 },
  powerAlertGh: { minimum: 100, maximum: 100_000 },
};

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function adminContext() {
  const user = await getChatGPTUser();
  if (!user || !env.DB) return null;
  const accountId = await accountIdFor(user.email);
  const owner = await claimOrVerifyAdminOwner(
    env.DB,
    accountId,
    user.email,
    Date.now(),
  );
  if (!owner.allowed) return { forbidden: true as const, user };
  return {
    forbidden: false as const,
    accountId,
    db: env.DB,
    owner: owner.owner,
    user,
  };
}

function parseJsonObject(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function completeOwnerTestBalance(
  db: D1Database,
  accountId: string,
  now: number,
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await db
      .prepare(
        `SELECT state_json, version
         FROM game_states
         WHERE account_id = ?`,
      )
      .bind(accountId)
      .first<OwnerStateRow>();
    if (!row) {
      throw new Error(
        "Abra o jogo uma vez para criar sua conta antes de preparar o teste.",
      );
    }

    const state = JSON.parse(row.state_json) as PublicGameState;
    const currentBalance = Math.max(0, Number(state.cmaBalance ?? 0));
    const targetBalance = Math.max(currentBalance, OWNER_TEST_BALANCE_CMA);
    const deltaCma = targetBalance - currentBalance;
    if (deltaCma <= 0) {
      return { balanceCma: currentBalance, deltaCma: 0 };
    }

    const nextVersion = Number(row.version) + 1;
    const nextState = { ...state, cmaBalance: targetBalance };
    const updated = await db
      .prepare(
        `UPDATE game_states
         SET state_json = ?, version = ?, updated_at = ?
         WHERE account_id = ? AND version = ?`,
      )
      .bind(
        JSON.stringify(nextState),
        nextVersion,
        now,
        accountId,
        row.version,
      )
      .run();

    if (Number(updated.meta.changes ?? 0) !== 1) continue;

    await db
      .prepare(
        `INSERT INTO ledger_entries (
          id, account_id, action, idempotency_key, state_version,
          delta_cma_micros, metadata_json, created_at
        ) VALUES (?, ?, 'admin_test_cma_grant', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        accountId,
        `admin-test-cma:${now}:${crypto.randomUUID()}`,
        nextVersion,
        Math.round(deltaCma * 1_000_000),
        JSON.stringify({
          purpose: "closed_beta_network_test",
          balanceBeforeCma: currentBalance,
          balanceAfterCma: targetBalance,
        }),
        now,
      )
      .run();
    return { balanceCma: targetBalance, deltaCma };
  }

  throw new Error(
    "Sua conta foi atualizada em outro dispositivo. Tente novamente.",
  );
}

async function readAdminOverview(
  db: D1Database,
  now: number,
) {
  const since = now - 24 * 60 * 60 * 1000;
  const [
    totalPlayers,
    activePlayers,
    sessionMetrics,
    openReviews,
    crateOpens,
    batteryClaims,
    gameBreakdown,
    suspiciousSessions,
    ledgerSummary,
    recentCrates,
    stateRows,
    auditRows,
  ] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS total FROM game_states")
      .first<CountRow>(),
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM game_states WHERE updated_at >= ?",
      )
      .bind(since)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS games,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS wins,
                COALESCE(SUM(reward_power_gh), 0) AS power
         FROM game_sessions
         WHERE started_at >= ?`,
      )
      .bind(since)
      .first<SessionMetricRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions sessions
         LEFT JOIN admin_session_reviews reviews ON reviews.session_id = sessions.id
         WHERE sessions.risk_level != 'normal' AND reviews.session_id IS NULL`,
      )
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM ledger_entries
         WHERE action = 'open_supply_crate' AND created_at >= ?`,
      )
      .bind(since)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM ledger_entries
         WHERE action = 'daily_mission_battery' AND created_at >= ?`,
      )
      .bind(since)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT game_id, COUNT(*) AS plays,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS wins,
                COALESCE(SUM(reward_power_gh), 0) AS power
         FROM game_sessions
         WHERE started_at >= ?
         GROUP BY game_id
         ORDER BY plays DESC`,
      )
      .bind(since)
      .all<GameBreakdownRow>(),
    db
      .prepare(
        `SELECT sessions.id, sessions.account_id, sessions.game_id,
                sessions.status, sessions.started_at, sessions.completed_at,
                sessions.score, sessions.difficulty, sessions.risk_level,
                sessions.review_reason, states.display_name, states.email,
                reviews.resolution AS review_resolution,
                reviews.note AS review_note, reviews.reviewed_at
         FROM game_sessions sessions
         LEFT JOIN game_states states ON states.account_id = sessions.account_id
         LEFT JOIN admin_session_reviews reviews ON reviews.session_id = sessions.id
         WHERE sessions.risk_level != 'normal'
         ORDER BY sessions.started_at DESC
         LIMIT 30`,
      )
      .all<SuspiciousSessionRow>(),
    db
      .prepare(
        `SELECT action, COUNT(*) AS count,
                COALESCE(SUM(delta_cma_micros), 0) AS cma_delta_micros
         FROM ledger_entries
         WHERE created_at >= ?
         GROUP BY action
         ORDER BY count DESC`,
      )
      .bind(since)
      .all<LedgerSummaryRow>(),
    db
      .prepare(
        `SELECT ledger.id, ledger.action, ledger.metadata_json,
                ledger.created_at, states.display_name, states.email
         FROM ledger_entries ledger
         LEFT JOIN game_states states ON states.account_id = ledger.account_id
         WHERE ledger.action = 'open_supply_crate'
         ORDER BY ledger.created_at DESC
         LIMIT 15`,
      )
      .all<LedgerRow>(),
    db
      .prepare("SELECT state_json FROM game_states LIMIT 1000")
      .all<StateRow>(),
    db
      .prepare(
        `SELECT action, metadata_json, created_at
         FROM admin_audit_log
         ORDER BY created_at DESC
         LIMIT 12`,
      )
      .all<AuditRow>(),
  ]);

  const minerCounts = new Map<string, number>();
  let batteriesInInventory = 0;
  let installedRacks = 0;
  let playersWithEnergy = 0;
  let totalMiners = 0;
  for (const row of stateRows.results) {
    try {
      const state = JSON.parse(row.state_json) as {
        batteryCount?: number;
        energyExpiresAt?: number;
        minerInventory?: Array<{ minerId?: string }>;
        rackMiners?: Record<string, Array<{ minerId?: string }>>;
        racks?: unknown[];
      };
      batteriesInInventory += Math.max(0, Number(state.batteryCount ?? 0));
      installedRacks += Array.isArray(state.racks) ? state.racks.length : 0;
      if (Number(state.energyExpiresAt ?? 0) > now) playersWithEnergy += 1;
      const allMiners = [
        ...(Array.isArray(state.minerInventory) ? state.minerInventory : []),
        ...Object.values(state.rackMiners ?? {}).flat(),
      ];
      totalMiners += allMiners.length;
      for (const unit of allMiners) {
        if (!unit.minerId) continue;
        minerCounts.set(
          unit.minerId,
          (minerCounts.get(unit.minerId) ?? 0) + 1,
        );
      }
    } catch {
      // A malformed legacy state is ignored in aggregate inventory telemetry.
    }
  }
  const topMinerCount = Math.max(0, ...minerCounts.values());
  const minerConcentrationPercent =
    totalMiners > 0 ? Math.round((topMinerCount / totalMiners) * 100) : 0;

  return {
    metrics: {
      activePlayers24h: Number(activePlayers?.total ?? 0),
      batteryClaims24h: Number(batteryClaims?.total ?? 0),
      crateOpens24h: Number(crateOpens?.total ?? 0),
      games24h: Number(sessionMetrics?.games ?? 0),
      openReviews: Number(openReviews?.total ?? 0),
      powerGranted24h: Number(sessionMetrics?.power ?? 0),
      totalPlayers: Number(totalPlayers?.total ?? 0),
      wins24h: Number(sessionMetrics?.wins ?? 0),
    },
    games: gameBreakdown.results.map((row) => ({
      gameId: row.game_id,
      plays: Number(row.plays),
      power: Number(row.power),
      wins: Number(row.wins),
    })),
    suspiciousSessions: suspiciousSessions.results.map((row) => ({
      accountId: row.account_id,
      completedAt: row.completed_at,
      difficulty: Number(row.difficulty),
      displayName: row.display_name ?? row.email ?? "Operador",
      gameId: row.game_id,
      id: row.id,
      resolution: row.review_resolution,
      reviewNote: row.review_note,
      reviewReason: row.review_reason ?? "Comportamento fora do padrão.",
      reviewedAt: row.reviewed_at,
      riskLevel: row.risk_level,
      score: Number(row.score ?? 0),
      startedAt: row.started_at,
      status: row.status,
    })),
    ledger: ledgerSummary.results.map((row) => ({
      action: row.action,
      cmaDelta: Number(row.cma_delta_micros) / 1_000_000,
      count: Number(row.count),
    })),
    recentCrates: recentCrates.results.map((row) => {
      const metadata = parseJsonObject(row.metadata_json) as {
        supplyCrate?: {
          crateId?: string;
          pityTriggered?: boolean;
          reward?: { label?: string; rarity?: string };
        };
      };
      return {
        createdAt: row.created_at,
        displayName: row.display_name ?? row.email ?? "Operador",
        id: row.id,
        crateId: metadata.supplyCrate?.crateId ?? "unknown",
        pityTriggered: metadata.supplyCrate?.pityTriggered === true,
        rarity: metadata.supplyCrate?.reward?.rarity ?? "common",
        reward: metadata.supplyCrate?.reward?.label ?? "Item registrado",
      };
    }),
    inventory: {
      batteriesInInventory,
      installedRacks,
      minerConcentrationPercent,
      playersWithEnergy,
      totalMiners,
      topMiners: [...minerCounts.entries()]
        .map(([minerId, count]) => ({
          count,
          minerId,
          name: getMiner(minerId)?.name ?? minerId,
        }))
        .sort((first, second) => second.count - first.count)
        .slice(0, 6),
    },
    audit: auditRows.results.map((row) => ({
      action: row.action,
      createdAt: row.created_at,
      metadata: parseJsonObject(row.metadata_json),
    })),
  };
}

function economicSnapshot(
  overview: Awaited<ReturnType<typeof readAdminOverview>>,
) {
  return {
    activePlayers24h: overview.metrics.activePlayers24h,
    batteryClaims24h: overview.metrics.batteryClaims24h,
    crateOpens24h: overview.metrics.crateOpens24h,
    games24h: overview.metrics.games24h,
    installedRacks: overview.inventory.installedRacks,
    openReviews: overview.metrics.openReviews,
    powerGranted24h: overview.metrics.powerGranted24h,
    totalMiners: overview.inventory.totalMiners,
    totalPlayers: overview.metrics.totalPlayers,
    wins24h: overview.metrics.wins24h,
  };
}

export async function GET() {
  const context = await adminContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  if (context.forbidden) {
    return json({ error: "Este painel pertence ao proprietário do projeto." }, 403);
  }
  await ensureAdminSchema(context.db);
  const now = Date.now();
  const settings = await readAdminRuntimeSettings(context.db);
  const overview = await readAdminOverview(context.db, now);
  const network = await readNetworkPowerSnapshot(context.db, now);
  await ensureDefaultSeason(context.db, now);
  const season = await readSeasonOverview(context.db, context.accountId, now);
  return json({
    owner: {
      claimedAt: context.owner?.created_at ?? now,
      displayName: context.user.displayName,
      email: context.user.email,
    },
    alerts: evaluateAdminAlerts(
      {
        crateOpens24h: overview.metrics.crateOpens24h,
        minerConcentrationPercent:
          overview.inventory.minerConcentrationPercent,
        openReviews: overview.metrics.openReviews,
        powerGranted24h: overview.metrics.powerGranted24h,
      },
      settings,
    ),
    settings,
    season,
    network,
    ...overview,
    serverTime: now,
  });
}

export async function POST(request: Request) {
  const context = await adminContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  if (context.forbidden) {
    return json({ error: "Ação permitida apenas ao proprietário." }, 403);
  }
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        durationDays?: unknown;
        enabled?: unknown;
        name?: unknown;
        note?: unknown;
        bonusBps?: unknown;
        durationHours?: unknown;
        rewards?: unknown;
        resolution?: unknown;
        sessionId?: unknown;
        setting?: unknown;
        value?: unknown;
      }
    | null;
  const now = Date.now();
  await ensureDefaultSeason(context.db, now);

  if (body?.action === "set-block-budget") {
    const candidate =
      body.rewards && typeof body.rewards === "object"
        ? (body.rewards as Partial<Record<PoolId, unknown>>)
        : {};
    const rewards = Object.fromEntries(
      (["cma", "btc", "doge"] as const).map((poolId) => [
        poolId,
        Number(candidate[poolId]),
      ]),
    ) as Record<PoolId, number>;
    const invalidPool = (["cma", "btc", "doge"] as const).find((poolId) => {
      const value = rewards[poolId];
      const bounds = blockRewardBounds[poolId];
      return (
        !Number.isInteger(value) ||
        value < bounds.minimum ||
        value > bounds.maximum
      );
    });
    if (invalidPool) {
      return json(
        {
          error:
            "Orçamento recusado: use os limites seguros exibidos no painel.",
        },
        400,
      );
    }
    await updateBlockRewards(
      context.db,
      rewards,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "block_budget_updated",
      { rewards },
      now,
    );
    return json({
      message:
        "Orçamento fixo salvo. O novo valor será dividido a partir do próximo bloco.",
      network: await readNetworkPowerSnapshot(context.db, now),
    });
  }

  if (body?.action === "start-block-bonus") {
    const bonusBps = Number(body.bonusBps);
    const durationHours = Number(body.durationHours);
    if (
      ![12_500, 15_000, 20_000].includes(bonusBps) ||
      !Number.isFinite(durationHours) ||
      durationHours < 1 ||
      durationHours > 24
    ) {
      return json({ error: "Bônus ou duração fora dos limites seguros." }, 400);
    }
    const bonusEndsAt = now + Math.floor(durationHours * 60 * 60 * 1000);
    await updateBlockRewardBonus(
      context.db,
      bonusBps,
      bonusEndsAt,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "block_bonus_started",
      { bonusBps, bonusEndsAt, durationHours },
      now,
    );
    return json({
      message: `Evento de ${bonusBps / 100}% ativado por ${durationHours}h.`,
      network: await readNetworkPowerSnapshot(context.db, now),
    });
  }

  if (body?.action === "stop-block-bonus") {
    await updateBlockRewardBonus(
      context.db,
      10_000,
      0,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "block_bonus_stopped",
      {},
      now,
    );
    return json({
      message: "Bônus encerrado. Os blocos voltaram ao orçamento-base.",
      network: await readNetworkPowerSnapshot(context.db, now),
    });
  }

  if (body?.action === "prepare-economic-test") {
    try {
      const grant = await completeOwnerTestBalance(
        context.db,
        context.accountId,
        now,
      );
      await updateNetworkBasePower(
        context.db,
        ZERO_NETWORK_POWER,
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "economic_test_prepared",
        {
          grantedCma: grant.deltaCma,
          ownerBalanceCma: grant.balanceCma,
          networkBasePowerGh: ZERO_NETWORK_POWER,
        },
        now,
      );
      const network = await readNetworkPowerSnapshot(context.db, now);
      return json({
        message:
          grant.deltaCma > 0
            ? `Carteira de teste: +${grant.deltaCma.toLocaleString("pt-BR")} CMA.`
            : "Sua carteira de teste já possui 10.000 CMA ou mais.",
        network,
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível preparar o teste econômico.",
        },
        409,
      );
    }
  }

  if (body?.action === "restore-network-reference") {
    await updateNetworkBasePower(
      context.db,
      DEFAULT_NETWORK_BASE_POWER,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "network_reference_restored",
      { networkBasePowerGh: DEFAULT_NETWORK_BASE_POWER },
      now,
    );
    const network = await readNetworkPowerSnapshot(context.db, now);
    return json({
      message: "Poder-base de referência restaurado nas três redes.",
      network,
    });
  }

  if (
    body?.action === "create-season" &&
    typeof body.name === "string" &&
    typeof body.durationDays === "number" &&
    Number.isFinite(body.durationDays)
  ) {
    try {
      const season = await createSeason(
        context.db,
        body.name,
        body.durationDays,
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "season_created",
        season,
        now,
      );
      return json({ message: `${season.name} iniciada com sucesso.` });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível iniciar a temporada.",
        },
        409,
      );
    }
  }

  if (body?.action === "snapshot-season") {
    const overview = await readAdminOverview(context.db, now);
    try {
      const snapshot = await createSeasonSnapshot(
        context.db,
        economicSnapshot(overview),
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "season_snapshot_created",
        snapshot,
        now,
      );
      return json({ message: "Snapshot econômico registrado na temporada." });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível registrar o snapshot.",
        },
        409,
      );
    }
  }

  if (body?.action === "close-season") {
    const overview = await readAdminOverview(context.db, now);
    try {
      const snapshot = await createSeasonSnapshot(
        context.db,
        economicSnapshot(overview),
        context.accountId,
        now,
      );
      const season = await closeActiveSeason(
        context.db,
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "season_closed",
        { seasonId: season.id, finalSnapshotId: snapshot.id },
        now,
      );
      return json({
        message: "Temporada encerrada com snapshot final preservado.",
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível encerrar a temporada.",
        },
        409,
      );
    }
  }

  if (
    body?.action === "update-setting" &&
    typeof body.setting === "string" &&
    adminSettingKeys.includes(body.setting as AdminSettingKey) &&
    typeof body.enabled === "boolean"
  ) {
    const settings = await updateAdminRuntimeSetting(
      context.db,
      body.setting as AdminSettingKey,
      body.enabled,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "runtime_setting_updated",
      { setting: body.setting, enabled: body.enabled },
      now,
    );
    return json({
      message: body.enabled
        ? "Operação reativada com sucesso."
        : "Operação pausada com segurança.",
      settings,
    });
  }

  if (
    body?.action === "update-threshold" &&
    typeof body.setting === "string" &&
    Object.hasOwn(adminThresholdBounds, body.setting) &&
    typeof body.value === "number" &&
    Number.isFinite(body.value)
  ) {
    const threshold = body.setting as AdminThresholdKey;
    const bounds = adminThresholdBounds[threshold];
    const value = Math.floor(body.value);
    if (value < bounds.minimum || value > bounds.maximum) {
      return json(
        {
          error: `Use um valor entre ${bounds.minimum} e ${bounds.maximum}.`,
        },
        400,
      );
    }
    const settings = await updateAdminAlertThreshold(
      context.db,
      threshold,
      value,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "alert_threshold_updated",
      { threshold, value },
      now,
    );
    return json({
      message: "Limite de alerta atualizado.",
      settings,
    });
  }

  if (
    body?.action === "review-session" &&
    typeof body.sessionId === "string" &&
    body.sessionId.length >= 8 &&
    (body.resolution === "cleared" || body.resolution === "confirmed")
  ) {
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 280) : "";
    const session = await context.db
      .prepare(
        `SELECT id FROM game_sessions
         WHERE id = ? AND risk_level != 'normal'`,
      )
      .bind(body.sessionId)
      .first<{ id: string }>();
    if (!session) {
      return json({ error: "Sessão de revisão não encontrada." }, 404);
    }
    await context.db
      .prepare(
        `INSERT INTO admin_session_reviews (
          session_id, resolution, note, reviewed_by, reviewed_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          resolution = excluded.resolution,
          note = excluded.note,
          reviewed_by = excluded.reviewed_by,
          reviewed_at = excluded.reviewed_at`,
      )
      .bind(
        body.sessionId,
        body.resolution,
        note,
        context.accountId,
        now,
      )
      .run();
    await writeAdminAudit(
      context.db,
      context.accountId,
      "suspicious_session_reviewed",
      {
        sessionId: body.sessionId,
        resolution: body.resolution,
        note,
      },
      now,
    );
    return json({ message: "Revisão registrada no histórico administrativo." });
  }

  return json({ error: "Ação administrativa inválida." }, 400);
}

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
import { getMiner } from "../../game-rules";

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
        enabled?: unknown;
        note?: unknown;
        resolution?: unknown;
        sessionId?: unknown;
        setting?: unknown;
        value?: unknown;
      }
    | null;
  const now = Date.now();

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

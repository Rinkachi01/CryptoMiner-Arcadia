import { env } from "cloudflare:workers";
import {
  adminOwnerAccountIdFromEnv,
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
import { buildAdminCrmAlerts } from "../../admin-crm-alert-rules";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { getMiner, type PoolId } from "../../game-rules";
import { normalizePoolAllocations, type PublicGameState } from "../../game-server";
import { getRoomDefinition } from "../../room-rules";
import {
  ensureBetaFeedbackSchema,
  readAdminBetaFeedback,
} from "../../feedback-server";
import { isBetaFeedbackStatus } from "../../feedback-rules";
import {
  compactEligibleGameProofs,
} from "../../beta-observability";
import {
  DEFAULT_NETWORK_BASE_POWER,
  ZERO_NETWORK_POWER,
  ensureNetworkSchema,
  readNetworkPowerSnapshot,
  updateBlockRewardSchedules,
  updateBlockRewards,
  type PoolBonusSchedules,
  updateNetworkBasePower,
} from "../../network-server";
import {
  createOperationalCheckpoint,
  ensureOperationsSchema,
  readOperationalHealth,
} from "../../operations-server";
import {
  createRecoveryArchive,
  readRecoveryOverview,
  recoveryBucketFromEnv,
  runRecoveryDrill,
} from "../../recovery-server";
import {
  activateSpaceRaceSeason,
  closeActiveSeason,
  createSeason,
  createSeasonSnapshot,
  ensureDefaultSeason,
  readSeasonEconomicReport,
  readSeasonOverview,
} from "../../season-server";
import {
  ensureSecuritySchema,
  readSecurityOverview,
} from "../../security-server";
import {
  ensureConversionSchema,
  readConversionOverview,
} from "../../conversion-server";
import { readPublicLaunchReadiness } from "../../public-launch-server";
import {
  manuallyCreditPixDeposit,
  readAdminPixDeposits,
} from "../../pix-server";
import {
  readAdminCryptoDeposits,
  readAdminWithdrawalOverview,
} from "../../wallet-server";
import {
  deliverSupportReply,
  readSupportEmailConfig,
} from "../../support-email-server";
import {
  ensureSupportSchema,
  isSupportTicketStatus,
  readAdminSupportOverview,
} from "../../support-server";

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

type BlockSettlementRow = {
  created_at: number;
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
  ltc: { minimum: 1_000, maximum: 100_000 },
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

async function adminContext() {
  const user = await getArcadiaUser();
  if (!user || !env.DB) return null;
  const accountId = await accountIdForUser(user);
  const owner = await claimOrVerifyAdminOwner(
    env.DB,
    accountId,
    user.email,
    Date.now(),
    adminOwnerAccountIdFromEnv(env),
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

async function readOwnerOperatingBalance(
  db: D1Database,
  accountId: string,
) {
  const row = await db
    .prepare("SELECT state_json FROM game_states WHERE account_id = ?")
    .bind(accountId)
    .first<Pick<OwnerStateRow, "state_json">>();
  if (!row) return 0;
  try {
    const state = JSON.parse(row.state_json) as Partial<PublicGameState>;
    const balance = Number(state.cmaBalance ?? 0);
    return Number.isFinite(balance) ? Math.max(0, balance) : 0;
  } catch {
    return 0;
  }
}

async function readSeasonSalesSummary(
  db: D1Database,
  seasonId: string | null,
) {
  if (!seasonId) {
    return { maxAccounts: 0, premiumAccounts: 0, revenueCma: 0 };
  }
  const [passes, maxPasses] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(cma_paid_micros), 0) AS revenue_micros
         FROM season_passes
         WHERE season_id = ? AND premium_unlocked = 1`,
      )
      .bind(seasonId)
      .first<{ revenue_micros: number; total: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM season_pass_max
         WHERE season_id = ?`,
      )
      .bind(seasonId)
      .first<{ total: number }>(),
  ]);
  return {
    maxAccounts: Math.max(0, Number(maxPasses?.total ?? 0)),
    premiumAccounts: Math.max(0, Number(passes?.total ?? 0)),
    revenueCma: Math.max(0, Number(passes?.revenue_micros ?? 0)) / 1_000_000,
  };
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
    blockSettlements,
    recentCrates,
    stateRows,
    auditRows,
    treasuryTotals,
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
        `SELECT id, metadata_json, created_at
         FROM ledger_entries
         WHERE action = 'block_settlement' AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 500`,
      )
      .bind(since)
      .all<BlockSettlementRow>(),
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
      // Inventory telemetry is intentionally bounded. Full state snapshots
      // are large JSON documents; loading thousands of them in one request
      // can exhaust the Worker memory budget while opening the CRM.
      .prepare("SELECT state_json FROM game_states LIMIT 250")
      .all<StateRow>(),
    db
      .prepare(
        `SELECT action, metadata_json, created_at
         FROM admin_audit_log
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .all<AuditRow>(),
    db
      .prepare(
        `SELECT action, COALESCE(SUM(delta_cma_micros), 0) AS cma_micros
         FROM ledger_entries
         WHERE action IN ('pix_deposit', 'crypto_deposit', 'crypto_withdrawal')
         GROUP BY action`,
      )
      .all<{ action: string; cma_micros: number }>(),
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
  const emissionRewardsAtomic = blockSettlements.results.reduce(
    (total, row) => {
      const metadata = parseJsonObject(row.metadata_json) as {
        rewards?: Partial<Record<PoolId, unknown>>;
      };
      for (const poolId of ["cma", "btc", "doge", "ltc"] as const) {
        const reward = Number(metadata.rewards?.[poolId]);
        if (Number.isFinite(reward) && reward > 0) {
          total[poolId] += Math.floor(reward);
        }
      }
      return total;
    },
    { cma: 0, btc: 0, doge: 0, ltc: 0 } as Record<PoolId, number>,
  );

  const treasury = {
    depositsCma: 0,
    withdrawalsCma: 0,
  };
  for (const row of treasuryTotals.results) {
    if (row.action === 'pix_deposit' || row.action === 'crypto_deposit') {
      treasury.depositsCma += Number(row.cma_micros) / 1_000_000;
    }
    if (row.action === 'crypto_withdrawal') {
      treasury.withdrawalsCma += Math.abs(Number(row.cma_micros) / 1_000_000);
    }
  }

  return {
    emission24h: {
      rewardsAtomic: emissionRewardsAtomic,
      settlementRecords: blockSettlements.results.length,
    },
    treasury,
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
      email: row.email ?? "",
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

export async function GET(request: Request) {
  const context = await adminContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  if (context.forbidden) {
    return json({ error: "Este painel pertence ao proprietário do projeto." }, 403);
  }
  await Promise.all([
    ensureAdminSchema(context.db),
    ensureNetworkSchema(context.db),
    ensureOperationsSchema(context.db),
    ensureSecuritySchema(context.db),
    ensureConversionSchema(context.db),
    ensureSupportSchema(context.db),
  ]);
  const now = Date.now();
  const search = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (search) {
    if (search.length < 2 || search.length > 80) {
      return json({ error: "Pesquise entre 2 e 80 caracteres." }, 400);
    }
    const pattern = `%${search.toLocaleLowerCase("pt-BR")}%`;
    const rows = await context.db
      .prepare(
        `SELECT account_id, display_name, email, state_json, created_at, updated_at
         FROM game_states
         WHERE LOWER(COALESCE(display_name, '')) LIKE ?
            OR LOWER(COALESCE(email, '')) LIKE ?
            OR LOWER(account_id) LIKE ?
         ORDER BY updated_at DESC
         LIMIT 20`,
      )
      .bind(pattern, pattern, pattern)
      .all<{
        account_id: string;
        created_at: number;
        display_name: string | null;
        email: string | null;
        state_json: string;
        updated_at: number;
      }>();
    return json({
      users: rows.results.map((row) => {
        let state: Partial<PublicGameState> = {};
        try {
          state = JSON.parse(row.state_json) as Partial<PublicGameState>;
        } catch {
          // The search remains useful even if a legacy state needs repair.
        }
        return {
          accountId: row.account_id,
          batteryCount: Math.max(0, Number(state.batteryCount ?? 0)),
          cmaBalance: Math.max(0, Number(state.cmaBalance ?? 0)),
          createdAt: row.created_at,
          displayName: row.display_name ?? "Operador Arcadia",
          email: row.email ?? "",
          poolAllocations:
            normalizePoolAllocations(
              state.poolAllocations ??
                (state as unknown as Record<string, unknown>).gamePoolAllocations,
            ) ??
            ({ cma: 100, btc: 0, doge: 0, ltc: 0 } as const),
          activeRoomId: state.activeRoomId ?? "room-1",
          activeRoomName:
            getRoomDefinition(state.activeRoomId)?.name ?? "Oficina Neon",
          mainRoomName: getRoomDefinition("room-1")?.name ?? "Oficina Neon",
          mainRoomRackCount: Array.isArray(state.racks)
            ? state.racks.filter((rack) => rack.roomId === "room-1").length
            : 0,
          mainRoomMinerCount: Array.isArray(state.racks)
            ? state.racks
                .filter((rack) => rack.roomId === "room-1")
                .reduce(
                  (total, rack) =>
                    total +
                    (Array.isArray(state.rackMiners?.[rack.id])
                      ? state.rackMiners?.[rack.id].length ?? 0
                      : 0),
                  0,
                )
            : 0,
          minerCount:
            (Array.isArray(state.minerInventory) ? state.minerInventory.length : 0) +
            Object.values(state.rackMiners ?? {}).reduce(
              (total, units) => total + (Array.isArray(units) ? units.length : 0),
              0,
            ),
          rackCount: Array.isArray(state.racks) ? state.racks.length : 0,
          roomCount: Array.isArray(state.ownedRoomIds) ? state.ownedRoomIds.length : 1,
          updatedAt: row.updated_at,
        };
      }),
    });
  }
  const bucket = recoveryBucketFromEnv(env);
  const [
    settings,
    overview,
    network,
    feedback,
    operations,
    recovery,
    security,
    conversion,
    support,
    pixDeposits,
    cryptoDeposits,
    withdrawalQueue,
  ] = await Promise.all([
    readAdminRuntimeSettings(context.db),
    readAdminOverview(context.db, now),
    readNetworkPowerSnapshot(context.db, now),
    readAdminBetaFeedback(context.db, now),
    readOperationalHealth(context.db, now),
    readRecoveryOverview(context.db, bucket, now),
    readSecurityOverview(context.db, env, now),
    readConversionOverview(context.db, now),
    readAdminSupportOverview(context.db),
    readAdminPixDeposits(context.db),
    readAdminCryptoDeposits(context.db),
    readAdminWithdrawalOverview({ db: context.db, environment: env }),
  ]);
  await ensureDefaultSeason(context.db, now);
  const [season, seasonReport, ownerBalanceCma] = await Promise.all([
    readSeasonOverview(context.db, context.accountId, now, true),
    readSeasonEconomicReport(context.db, now),
    readOwnerOperatingBalance(context.db, context.accountId),
  ]);
  const seasonSales = await readSeasonSalesSummary(
    context.db,
    season.season?.id ?? season.draft?.id ?? null,
  );
  const crmAlerts = buildAdminCrmAlerts({
    auditEvents: overview.audit,
    feedbackEvents: feedback.recent,
    now,
    securityEvents: security.recentEvents,
    supportEvents: support.tickets.filter((ticket) => ticket.status === "open").map((ticket) => ({
      createdAt: ticket.createdAt,
      email: ticket.email,
      publicId: ticket.publicId,
      status: ticket.status,
      subject: ticket.subject,
    })),
    treasuryEvents: [
      ...pixDeposits.deposits.map((deposit) => ({
        amount: `BRL ${deposit.brlAmount.toFixed(2)}`,
        createdAt: deposit.updatedAt || deposit.createdAt,
        displayName: deposit.displayName,
        id: deposit.id,
        kind: "deposit" as const,
        reference: deposit.providerReference ?? undefined,
        status: deposit.status,
      })),
      ...cryptoDeposits.map((deposit) => ({
        amount: deposit.amount,
        asset: deposit.asset,
        createdAt: deposit.createdAt,
        displayName: deposit.displayName,
        id: deposit.id,
        kind: "deposit" as const,
        reference: deposit.reference,
        status: deposit.status,
      })),
      ...withdrawalQueue.requests.map((request) => ({
        amount: request.payoutBrlCents > 0
          ? `BRL ${(request.payoutBrlCents / 100).toFixed(2)}`
          : "",
        asset: request.asset,
        createdAt: request.updatedAt || request.createdAt,
        displayName: request.displayName,
        id: request.id,
        kind: "withdrawal" as const,
        reference: request.transactionReference ?? undefined,
        status: request.status,
      })),
    ],
  });
  return json({
    owner: {
      claimedAt: context.owner?.created_at ?? now,
      cmaBalance: ownerBalanceCma,
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
    seasonSales,
    seasonReport,
    network,
    feedback,
    operations,
    recovery,
    security,
    conversion,
    pixDeposits,
    support: {
      ...support,
      emailEnabled: readSupportEmailConfig(env).enabled,
      emailProvider: readSupportEmailConfig(env).provider,
    },
    launch: readPublicLaunchReadiness(env, request.url),
    crmAlerts,
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
        pixConfirmation?: unknown;
        pixIntentId?: unknown;
        pixReason?: unknown;
        bonusBps?: unknown;
        durationHours?: unknown;
        startAt?: unknown;
        poolIds?: unknown;
        feedbackId?: unknown;
        feedbackStatus?: unknown;
        rewards?: unknown;
        resolution?: unknown;
        sessionId?: unknown;
        supportReply?: unknown;
        supportStatus?: unknown;
        supportTicketId?: unknown;
        setting?: unknown;
        value?: unknown;
      }
    | null;
  const now = Date.now();
  await ensureDefaultSeason(context.db, now);

  if (body?.action === "manual-credit-pix") {
    const intentId = typeof body.pixIntentId === "string" ? body.pixIntentId.trim() : "";
    const reason = typeof body.pixReason === "string" ? body.pixReason.trim() : "";
    if (!/^pix-[0-9a-f-]{36}$/i.test(intentId)) {
      return json({ error: "Cobrança Pix inválida." }, 400);
    }
    if (body.pixConfirmation !== "CREDITAR") {
      return json({ error: "Digite CREDITAR para confirmar a exceção manual." }, 400);
    }
    try {
      const result = await manuallyCreditPixDeposit({
        db: context.db,
        intentId,
        now,
        ownerAccountId: context.accountId,
        reason,
      });
      await writeAdminAudit(
        context.db,
        context.accountId,
        "pix_manually_credited",
        { ...result, reason },
        now,
      );
      return json({
        message: result.alreadyCredited
          ? "Esta cobrança já estava creditada; nenhum saldo foi duplicado."
          : `${result.cmaUnits} CMA creditado manualmente com auditoria.`,
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Crédito Pix manual recusado." },
        409,
      );
    }
  }

  if (body?.action === "activate-space-race") {
    try {
      const activation = await activateSpaceRaceSeason(
        context.db,
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "space_race_season_activated",
        activation,
        now,
      );
      return json({
        message: activation.alreadyActive
          ? "A Corrida Espacial já está ativa."
          : "Corrida Espacial ativada por 120 dias.",
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível ativar a Corrida Espacial.",
        },
        409,
      );
    }
  }

  if (
    body?.action === "update-support-ticket" &&
    typeof body.supportTicketId === "string" &&
    /^CMA-[A-Z0-9]{8}$/.test(body.supportTicketId) &&
    isSupportTicketStatus(body.supportStatus)
  ) {
    await ensureSupportSchema(context.db);
    const ticket = await context.db
      .prepare(
        `SELECT public_id, email, subject, admin_note, reply_delivery_status
         FROM support_tickets
         WHERE public_id = ?`,
      )
      .bind(body.supportTicketId)
      .first<{
        admin_note: string;
        email: string;
        public_id: string;
        reply_delivery_status: string;
        subject: string;
      }>();
    if (!ticket) return json({ error: "Protocolo não encontrado." }, 404);

    const rawSupportReply =
      typeof body.supportReply === "string" ? body.supportReply.trim() : "";
    if (rawSupportReply.length > 2_000) {
      return json({ error: "A resposta deve ter no máximo 2.000 caracteres." }, 400);
    }
    const supportReply = rawSupportReply;
    if (supportReply && supportReply.length < 10) {
      return json({ error: "A resposta deve ter pelo menos 10 caracteres." }, 400);
    }
    await context.db
      .prepare(
        `UPDATE support_tickets
         SET status = ?, updated_at = ?
         WHERE public_id = ?`,
      )
      .bind(body.supportStatus, now, ticket.public_id)
      .run();

    let replyStatus = ticket.reply_delivery_status;
    const shouldSendReply = Boolean(
      supportReply &&
        (supportReply !== ticket.admin_note ||
          ticket.reply_delivery_status !== "sent"),
    );
    if (shouldSendReply) {
      await context.db
        .prepare(
          `UPDATE support_tickets
           SET admin_note = ?, last_reply_at = ?, last_reply_by = ?,
               reply_delivery_status = 'processing', updated_at = ?
           WHERE public_id = ?`,
        )
        .bind(
          supportReply,
          now,
          context.accountId,
          now,
          ticket.public_id,
        )
        .run();
      const delivery = await deliverSupportReply(
        env,
        {
          email: ticket.email,
          publicId: ticket.public_id,
          subject: ticket.subject,
        },
        supportReply,
      );
      replyStatus = delivery.status;
      await context.db
        .prepare(
          `UPDATE support_tickets
           SET reply_delivery_status = ?, reply_provider_message_id = ?,
               updated_at = ?
           WHERE public_id = ?`,
        )
        .bind(
          delivery.status,
          "providerId" in delivery ? delivery.providerId : null,
          Date.now(),
          ticket.public_id,
        )
        .run();
    }
    await writeAdminAudit(
      context.db,
      context.accountId,
      "support_ticket_updated",
      {
        publicId: ticket.public_id,
        replyStatus,
        status: body.supportStatus,
      },
      now,
    );
    return json({
      message: shouldSendReply
        ? replyStatus === "sent"
          ? "Resposta enviada e protocolo atualizado."
          : "Resposta salva no protocolo; o e-mail aguarda a ativação do domínio."
        : "Etapa do protocolo atualizada.",
    });
  }

  if (body?.action === "create-recovery-archive") {
    try {
      const archive = await createRecoveryArchive(
        context.db,
        recoveryBucketFromEnv(env),
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "recovery_archive_created",
        archive,
        now,
      );
      return json({
        message: `Cópia externa concluída: ${archive.rowCount.toLocaleString("pt-BR")} registros verificados.`,
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível criar a cópia externa.",
        },
        409,
      );
    }
  }

  if (body?.action === "run-recovery-drill") {
    try {
      const drill = await runRecoveryDrill(
        context.db,
        recoveryBucketFromEnv(env),
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "recovery_drill_completed",
        {
          archiveStatus: drill.status,
          drillId: drill.id,
        },
        now,
      );
      return json({
        message:
          drill.status === "passed"
            ? "Ensaio aprovado. A cópia atual pode ser lida e reconstruída sem tocar nas contas ativas."
            : "O ensaio encontrou inconsistências. Nenhuma conta foi alterada; revise os indicadores.",
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível executar o ensaio.",
        },
        409,
      );
    }
  }

  if (body?.action === "create-operations-checkpoint") {
    const checkpoint = await createOperationalCheckpoint(
      context.db,
      context.accountId,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "operational_checkpoint_created",
      {
        checkpointId: checkpoint.id,
        status: checkpoint.status,
      },
      now,
    );
    return json({
      message:
        "Checkpoint de integridade registrado. Ele preserva o diagnóstico, mas não substitui um backup.",
    });
  }

  if (body?.action === "compact-game-proofs") {
    const result = await compactEligibleGameProofs(context.db, now);
    await writeAdminAudit(
      context.db,
      context.accountId,
      "old_game_proofs_compacted",
      result,
      now,
    );
    return json({
      message:
        result.compacted > 0
          ? `${result.compacted} comprovante(s) antigo(s) compactado(s). O ledger e os resultados foram preservados.`
          : "Nenhum comprovante antigo estava elegível para compactação.",
    });
  }

  if (
    body?.action === "set-feedback-status" &&
    typeof body.feedbackId === "string" &&
    body.feedbackId.length >= 8 &&
    isBetaFeedbackStatus(body.feedbackStatus)
  ) {
    await ensureBetaFeedbackSchema(context.db);
    const updated = await context.db
      .prepare(
        `UPDATE beta_feedback
         SET status = ?
         WHERE id = ?`,
      )
      .bind(body.feedbackStatus, body.feedbackId)
      .run();
    if (Number(updated.meta.changes ?? 0) !== 1) {
      return json({ error: "Feedback não encontrado." }, 404);
    }
    await writeAdminAudit(
      context.db,
      context.accountId,
      "beta_feedback_status_updated",
      {
        feedbackId: body.feedbackId,
        status: body.feedbackStatus,
      },
      now,
    );
    return json({ message: "Etapa do feedback atualizada." });
  }

  if (body?.action === "set-block-budget") {
    const candidate =
      body.rewards && typeof body.rewards === "object"
        ? (body.rewards as Partial<Record<PoolId, unknown>>)
        : {};
    const rewards = Object.fromEntries(
      (["cma", "btc", "doge", "ltc"] as const).map((poolId) => [
        poolId,
        Number(candidate[poolId]),
      ]),
    ) as Record<PoolId, number>;
    const invalidPool = (["cma", "btc", "doge", "ltc"] as const).find((poolId) => {
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
    const requestedStartAt = Number(body.startAt);
    const bonusStartsAt = Number.isFinite(requestedStartAt)
      ? Math.floor(requestedStartAt)
      : now;
    if (
      ![12_500, 15_000, 20_000].includes(bonusBps) ||
      !Number.isFinite(durationHours) ||
      durationHours < 1 ||
      durationHours > 168 ||
      bonusStartsAt < now - 5 * 60 * 1000 ||
      bonusStartsAt > now + 30 * 24 * 60 * 60 * 1000
    ) {
      return json({ error: "Bônus ou duração fora dos limites seguros." }, 400);
    }
    const bonusEndsAt =
      bonusStartsAt + Math.floor(durationHours * 60 * 60 * 1000);
    const requestedPools = Array.isArray(body.poolIds)
      ? body.poolIds.filter((value): value is PoolId =>
          ["cma", "btc", "doge", "ltc"].includes(value as PoolId),
        )
      : [];
    const poolIds = [...new Set(requestedPools)];
    if (Array.isArray(body.poolIds) && (poolIds.length === 0 || poolIds.length !== body.poolIds.length)) {
      return json({ error: "Selecione pelo menos uma pool válida." }, 400);
    }
    const network = await readNetworkPowerSnapshot(context.db, now);
    const schedules: PoolBonusSchedules = { ...network.bonusSchedules };
    const targets: PoolId[] = poolIds.length > 0 ? poolIds : ["cma", "btc", "doge", "ltc"];
    for (const poolId of targets) {
      schedules[poolId] = { bps: bonusBps, startsAt: bonusStartsAt, endsAt: bonusEndsAt };
    }
    await updateBlockRewardSchedules(context.db, schedules, context.accountId, now);
    await writeAdminAudit(
      context.db,
      context.accountId,
      "block_bonus_scheduled",
      { bonusBps, bonusStartsAt, bonusEndsAt, durationHours, poolIds: targets },
      now,
    );
    return json({
      message:
        bonusStartsAt > now
          ? `Evento de ${bonusBps / 100}% agendado por ${durationHours}h para ${targets.join(", ")}.`
          : `Evento de ${bonusBps / 100}% ativado para ${targets.join(", ")} por ${durationHours}h.`,
      network: await readNetworkPowerSnapshot(context.db, now),
    });
  }

  if (body?.action === "stop-block-bonus") {
    const requestedPools = Array.isArray(body.poolIds)
      ? body.poolIds.filter((value): value is PoolId =>
          ["cma", "btc", "doge", "ltc"].includes(value as PoolId),
        )
      : [];
    const poolIds = [...new Set(requestedPools)];
    const network = await readNetworkPowerSnapshot(context.db, now);
    const schedules: PoolBonusSchedules = { ...network.bonusSchedules };
    const targets: PoolId[] = poolIds.length > 0 ? poolIds : ["cma", "btc", "doge", "ltc"];
    for (const poolId of targets) schedules[poolId] = { bps: 10_000, startsAt: 0, endsAt: 0 };
    await updateBlockRewardSchedules(context.db, schedules, context.accountId, now);
    await writeAdminAudit(
      context.db,
      context.accountId,
      "block_bonus_stopped",
      { poolIds: targets },
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

  if (body?.action === "replenish-owner-wallet") {
    try {
      const grant = await completeOwnerTestBalance(
        context.db,
        context.accountId,
        now,
      );
      await writeAdminAudit(
        context.db,
        context.accountId,
        "owner_wallet_replenished",
        {
          grantedCma: grant.deltaCma,
          ownerBalanceCma: grant.balanceCma,
        },
        now,
      );
      return json({
        message:
          grant.deltaCma > 0
            ? `Reserva operacional: +${grant.deltaCma.toLocaleString("pt-BR")} CMA. Saldo atual: ${grant.balanceCma.toLocaleString("pt-BR")} CMA.`
            : "A reserva operacional já possui 10.000 CMA ou mais.",
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível repor a reserva operacional.",
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
      message: "Poder-base de referência restaurado nas quatro redes.",
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

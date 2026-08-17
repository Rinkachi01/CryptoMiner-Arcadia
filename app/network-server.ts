import {
  DEFAULT_BLOCK_REWARD_ATOMIC,
  getInstalledPower,
  pools,
  type PoolId,
} from "./game-rules.ts";
import type {
  PoolAllocations,
  PublicGameState,
} from "./game-server.ts";

export type NetworkPowerMap = Record<PoolId, number>;
export type BlockRewardMap = Record<PoolId, number>;

export type PoolBonusSchedule = {
  bps: number;
  startsAt: number;
  endsAt: number;
};

export type PoolBonusSchedules = Record<PoolId, PoolBonusSchedule>;

export type NetworkPowerSnapshot = {
  basePowerGh: NetworkPowerMap;
  playerPowerGh: NetworkPowerMap;
  totalPowerGh: NetworkPowerMap;
  baseBlockRewardAtomic: BlockRewardMap;
  blockRewardAtomic: BlockRewardMap;
  bonusActive: boolean;
  bonusBps: number;
  bonusStartsAt: number;
  bonusEndsAt: number;
  bonusSchedules: PoolBonusSchedules;
  testMode: boolean;
  updatedAt: number;
};

type NetworkSettingsRow = {
  base_btc_gh: number;
  base_cma_gh: number;
  base_doge_gh: number;
  base_ltc_gh: number;
  reward_btc_atomic: number;
  reward_cma_atomic: number;
  reward_doge_atomic: number;
  reward_ltc_atomic: number;
  reward_bonus_bps: number;
  reward_bonus_starts_at: number;
  reward_bonus_ends_at: number;
  reward_bonus_schedule_json?: string;
  updated_at: number;
};

type NetworkStateRow = {
  account_id: string;
  state_json: string;
};

type NetworkPowerTotalsRow = {
  cma_gh: number;
  btc_gh: number;
  doge_gh: number;
  ltc_gh: number;
};

export type AccountNetworkContribution = {
  accountId: string;
  installedPowerGh: number;
  allocations: PoolAllocations;
  energyExpiresAt: number;
};

// Never rebuild the entire index in the request that is serving a page. The
// old loop kept reading batches until every account was migrated, which made
// a single network snapshot scale with the whole database and could exhaust
// the Worker CPU/memory budget (Cloudflare 1102). A small bounded batch keeps
// the index convergent while leaving the request responsive; active accounts
// are also synchronised on every game mutation.
const NETWORK_BACKFILL_BATCH_SIZE = 25;
const NETWORK_POOL_IDS = ["cma", "btc", "doge", "ltc"] as const;

export const DEFAULT_NETWORK_BASE_POWER: NetworkPowerMap = {
  cma: pools.find((pool) => pool.id === "cma")?.networkPowerGh ?? 0,
  btc: pools.find((pool) => pool.id === "btc")?.networkPowerGh ?? 0,
  doge: pools.find((pool) => pool.id === "doge")?.networkPowerGh ?? 0,
  ltc: pools.find((pool) => pool.id === "ltc")?.networkPowerGh ?? 0,
};

export const ZERO_NETWORK_POWER: NetworkPowerMap = {
  cma: 0,
  btc: 0,
  doge: 0,
  ltc: 0,
};

export const DEFAULT_BLOCK_REWARDS: BlockRewardMap = {
  ...DEFAULT_BLOCK_REWARD_ATOMIC,
};

function emptyBonusSchedules(): PoolBonusSchedules {
  return {
    cma: { bps: 10_000, startsAt: 0, endsAt: 0 },
    btc: { bps: 10_000, startsAt: 0, endsAt: 0 },
    doge: { bps: 10_000, startsAt: 0, endsAt: 0 },
    ltc: { bps: 10_000, startsAt: 0, endsAt: 0 },
  };
}

function normalizeBonusSchedule(value: unknown): PoolBonusSchedule {
  const candidate = value && typeof value === "object"
    ? value as Partial<PoolBonusSchedule>
    : {};
  const bps = safePower(candidate.bps);
  const startsAt = safePower(candidate.startsAt);
  const endsAt = safePower(candidate.endsAt);
  return {
    bps: bps >= 10_000 ? bps : 10_000,
    startsAt,
    endsAt: endsAt > startsAt ? endsAt : 0,
  };
}

export function readBonusSchedules(settings: Pick<NetworkSettingsRow, "reward_bonus_schedule_json" | "reward_bonus_bps" | "reward_bonus_starts_at" | "reward_bonus_ends_at"> | null | undefined): PoolBonusSchedules {
  const schedules = emptyBonusSchedules();
  let parsed: unknown = null;
  try {
    parsed = settings?.reward_bonus_schedule_json
      ? JSON.parse(settings.reward_bonus_schedule_json)
      : null;
  } catch {
    parsed = null;
  }
  let hasStoredSchedule = false;
  if (parsed && typeof parsed === "object") {
    for (const poolId of NETWORK_POOL_IDS) {
      const candidate = (parsed as Record<string, unknown>)[poolId];
      if (candidate) {
        schedules[poolId] = normalizeBonusSchedule(candidate);
        hasStoredSchedule = true;
      }
    }
  }
  // Keep older installations (and the original global event) working until
  // the first per-pool schedule is saved.
  if (!hasStoredSchedule) {
    const global = normalizeBonusSchedule({
      bps: settings?.reward_bonus_bps,
      startsAt: settings?.reward_bonus_starts_at,
      endsAt: settings?.reward_bonus_ends_at,
    });
    for (const poolId of NETWORK_POOL_IDS) schedules[poolId] = global;
  }
  return schedules;
}

function safePower(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function validAllocations(value: unknown): PoolAllocations {
  if (!value || typeof value !== "object") {
    return { cma: 100, btc: 0, doge: 0, ltc: 0 };
  }
  const candidate = value as Partial<PoolAllocations>;
  const cma = safePower(candidate.cma);
  const btc = safePower(candidate.btc);
  const doge = safePower(candidate.doge);
  const ltc = safePower(candidate.ltc);
  return cma + btc + doge + ltc === 100
    ? { cma, btc, doge, ltc }
    : { cma: 100, btc: 0, doge: 0, ltc: 0 };
}

export function aggregatePlayerNetworkPower(
  states: Array<{
    accountId: string;
    state: Pick<
      PublicGameState,
      "energyExpiresAt" | "poolAllocations" | "rackMiners"
    >;
  }>,
  temporaryPowerByAccount: ReadonlyMap<string, number>,
  now: number,
): NetworkPowerMap {
  const totals: NetworkPowerMap = { cma: 0, btc: 0, doge: 0, ltc: 0 };

  for (const entry of states) {
    const installed = Object.values(entry.state.rackMiners ?? {}).flat();
    const minerPower =
      safePower(entry.state.energyExpiresAt) > now ? getInstalledPower(installed) : 0;
    const gamePower = safePower(temporaryPowerByAccount.get(entry.accountId));
    const allocations = validAllocations(entry.state.poolAllocations);
    for (const pool of pools) {
      totals[pool.id] += Math.floor((minerPower * allocations[pool.id]) / 100);
      totals[pool.id] += Math.floor((gamePower * allocations[pool.id]) / 100);
    }
  }

  return totals;
}

export function buildAccountNetworkContribution(
  accountId: string,
  state: Pick<
    PublicGameState,
    "energyExpiresAt" | "poolAllocations" | "rackMiners"
  >,
): AccountNetworkContribution {
  return {
    accountId,
    installedPowerGh: getInstalledPower(
      Object.values(state.rackMiners ?? {}).flat(),
    ),
    allocations: validAllocations(state.poolAllocations),
    energyExpiresAt: safePower(state.energyExpiresAt),
  };
}

function contributionUpsert(
  db: D1Database,
  contribution: AccountNetworkContribution,
  updatedAt: number,
) {
  return db
    .prepare(
      `INSERT INTO account_network_power (
        account_id, installed_power_gh, allocation_cma, allocation_btc,
        allocation_doge, allocation_ltc, energy_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        installed_power_gh = excluded.installed_power_gh,
        allocation_cma = excluded.allocation_cma,
        allocation_btc = excluded.allocation_btc,
        allocation_doge = excluded.allocation_doge,
        allocation_ltc = excluded.allocation_ltc,
        energy_expires_at = excluded.energy_expires_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      contribution.accountId,
      contribution.installedPowerGh,
      contribution.allocations.cma,
      contribution.allocations.btc,
      contribution.allocations.doge,
      contribution.allocations.ltc,
      contribution.energyExpiresAt,
      safePower(updatedAt),
    );
}

export async function ensureNetworkSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS network_runtime_settings (
        singleton_id INTEGER PRIMARY KEY NOT NULL,
        base_cma_gh INTEGER DEFAULT 60000000 NOT NULL,
        base_btc_gh INTEGER DEFAULT 1800000 NOT NULL,
        base_doge_gh INTEGER DEFAULT 4000000 NOT NULL,
        base_ltc_gh INTEGER DEFAULT 2500000 NOT NULL,
        reward_cma_atomic INTEGER DEFAULT 5000 NOT NULL,
        reward_btc_atomic INTEGER DEFAULT 5 NOT NULL,
        reward_doge_atomic INTEGER DEFAULT 1000000 NOT NULL,
        reward_ltc_atomic INTEGER DEFAULT 5000 NOT NULL,
        reward_bonus_bps INTEGER DEFAULT 10000 NOT NULL,
        reward_bonus_starts_at INTEGER DEFAULT 0 NOT NULL,
        reward_bonus_ends_at INTEGER DEFAULT 0 NOT NULL,
        reward_bonus_schedule_json TEXT DEFAULT '{}' NOT NULL,
        updated_at INTEGER DEFAULT 0 NOT NULL,
        updated_by TEXT
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS account_network_power (
        account_id TEXT PRIMARY KEY NOT NULL,
        installed_power_gh INTEGER DEFAULT 0 NOT NULL,
        allocation_cma INTEGER DEFAULT 100 NOT NULL,
        allocation_btc INTEGER DEFAULT 0 NOT NULL,
        allocation_doge INTEGER DEFAULT 0 NOT NULL,
        allocation_ltc INTEGER DEFAULT 0 NOT NULL,
        energy_expires_at INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER DEFAULT 0 NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS account_network_power_energy_expiry_idx
       ON account_network_power (energy_expires_at)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO network_runtime_settings (
        singleton_id, base_cma_gh, base_btc_gh, base_doge_gh, base_ltc_gh,
        reward_cma_atomic, reward_btc_atomic, reward_doge_atomic,
        reward_ltc_atomic,
        reward_bonus_bps, reward_bonus_starts_at, reward_bonus_ends_at,
        reward_bonus_schedule_json, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 10000, 0, 0, '{}', 0)`,
    )
    .bind(
      DEFAULT_NETWORK_BASE_POWER.cma,
      DEFAULT_NETWORK_BASE_POWER.btc,
      DEFAULT_NETWORK_BASE_POWER.doge,
      DEFAULT_NETWORK_BASE_POWER.ltc,
      DEFAULT_BLOCK_REWARDS.cma,
      DEFAULT_BLOCK_REWARDS.btc,
      DEFAULT_BLOCK_REWARDS.doge,
      DEFAULT_BLOCK_REWARDS.ltc,
    ),
  ]);

  // Upgrade databases created before scheduled bonuses without requiring a
  // manual production migration.
  try {
    await db
      .prepare(
        `ALTER TABLE network_runtime_settings
         ADD COLUMN reward_bonus_starts_at INTEGER DEFAULT 0 NOT NULL`,
      )
      .run();
  } catch {
    // The column already exists.
  }

  try {
    await db
      .prepare(
        `ALTER TABLE network_runtime_settings
         ADD COLUMN reward_bonus_schedule_json TEXT DEFAULT '{}' NOT NULL`,
      )
      .run();
  } catch {
    // The column already exists.
  }

}

export async function syncAccountNetworkPower(
  db: D1Database,
  accountId: string,
  state: Pick<
    PublicGameState,
    "energyExpiresAt" | "poolAllocations" | "rackMiners"
  >,
  updatedAt: number,
) {
  await ensureNetworkSchema(db);
  await contributionUpsert(
    db,
    buildAccountNetworkContribution(accountId, state),
    updatedAt,
  ).run();
}

async function backfillAccountNetworkPower(db: D1Database, now: number) {
  // Process one bounded batch only. Remaining legacy accounts converge on
  // subsequent requests (or when their owner next opens the game), instead
  // of turning one request into an unbounded migration job.
  const result = await db
    .prepare(
      `SELECT game_states.account_id, game_states.state_json
       FROM game_states
       LEFT JOIN account_network_power
         ON account_network_power.account_id = game_states.account_id
       WHERE account_network_power.account_id IS NULL
       ORDER BY game_states.account_id ASC
       LIMIT ?`,
    )
    .bind(NETWORK_BACKFILL_BATCH_SIZE)
    .all<NetworkStateRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) return;

  const statements = rows.map((row) => {
    try {
      const state = JSON.parse(row.state_json) as PublicGameState;
      return contributionUpsert(
        db,
        buildAccountNetworkContribution(row.account_id, state),
        now,
      );
    } catch {
      return contributionUpsert(
        db,
        {
          accountId: row.account_id,
          installedPowerGh: 0,
          allocations: { cma: 100, btc: 0, doge: 0, ltc: 0 },
          energyExpiresAt: 0,
        },
        now,
      );
    }
  });
  await db.batch(statements);
}

async function readIndexedPlayerPower(
  db: D1Database,
  now: number,
): Promise<NetworkPowerMap> {
  const [installed, temporary] = await Promise.all([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CAST(installed_power_gh * allocation_cma / 100 AS INTEGER)), 0) AS cma_gh,
           COALESCE(SUM(CAST(installed_power_gh * allocation_btc / 100 AS INTEGER)), 0) AS btc_gh,
           COALESCE(SUM(CAST(installed_power_gh * allocation_doge / 100 AS INTEGER)), 0) AS doge_gh,
           COALESCE(SUM(CAST(installed_power_gh * allocation_ltc / 100 AS INTEGER)), 0) AS ltc_gh
         FROM account_network_power
         WHERE energy_expires_at > ?`,
      )
      .bind(now)
      .first<NetworkPowerTotalsRow>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CAST(grants.power_gh * accounts.allocation_cma / 100 AS INTEGER)), 0) AS cma_gh,
           COALESCE(SUM(CAST(grants.power_gh * accounts.allocation_btc / 100 AS INTEGER)), 0) AS btc_gh,
           COALESCE(SUM(CAST(grants.power_gh * accounts.allocation_doge / 100 AS INTEGER)), 0) AS doge_gh,
           COALESCE(SUM(CAST(grants.power_gh * accounts.allocation_ltc / 100 AS INTEGER)), 0) AS ltc_gh
         FROM temporary_power_grants AS grants
         INNER JOIN account_network_power AS accounts
           ON accounts.account_id = grants.account_id
         WHERE grants.starts_at <= ?
           AND grants.expires_at > ?`,
      )
      .bind(now, now)
      .first<NetworkPowerTotalsRow>(),
  ]);

  return {
    cma: safePower(installed?.cma_gh) + safePower(temporary?.cma_gh),
    btc: safePower(installed?.btc_gh) + safePower(temporary?.btc_gh),
    doge: safePower(installed?.doge_gh) + safePower(temporary?.doge_gh),
    ltc: safePower(installed?.ltc_gh) + safePower(temporary?.ltc_gh),
  };
}

export async function updateNetworkBasePower(
  db: D1Database,
  values: NetworkPowerMap,
  actorAccountId: string,
  now: number,
) {
  await ensureNetworkSchema(db);
  await db
    .prepare(
      `UPDATE network_runtime_settings
       SET base_cma_gh = ?, base_btc_gh = ?, base_doge_gh = ?, base_ltc_gh = ?,
           updated_at = ?, updated_by = ?
       WHERE singleton_id = 1`,
    )
    .bind(
      safePower(values.cma),
      safePower(values.btc),
      safePower(values.doge),
      safePower(values.ltc),
      now,
      actorAccountId,
    )
    .run();
}

export async function updateBlockRewards(
  db: D1Database,
  values: BlockRewardMap,
  actorAccountId: string,
  now: number,
) {
  await ensureNetworkSchema(db);
  await db
    .prepare(
      `UPDATE network_runtime_settings
       SET reward_cma_atomic = ?, reward_btc_atomic = ?,
           reward_doge_atomic = ?, reward_ltc_atomic = ?,
           updated_at = ?, updated_by = ?
       WHERE singleton_id = 1`,
    )
    .bind(
      safePower(values.cma),
      safePower(values.btc),
      safePower(values.doge),
      safePower(values.ltc),
      now,
      actorAccountId,
    )
    .run();
}

export async function updateBlockRewardBonus(
  db: D1Database,
  bonusBps: number,
  bonusEndsAt: number,
  actorAccountId: string,
  now: number,
  bonusStartsAt = 0,
) {
  const schedule = normalizeBonusSchedule({
    bps: bonusBps,
    startsAt: bonusStartsAt,
    endsAt: bonusEndsAt,
  });
  const schedules: PoolBonusSchedules = {
    cma: schedule,
    btc: schedule,
    doge: schedule,
    ltc: schedule,
  };
  await updateBlockRewardSchedules(db, schedules, actorAccountId, now);
}

export async function updateBlockRewardSchedules(
  db: D1Database,
  schedules: PoolBonusSchedules,
  actorAccountId: string,
  now: number,
) {
  await ensureNetworkSchema(db);
  const normalized = emptyBonusSchedules();
  for (const poolId of NETWORK_POOL_IDS) {
    normalized[poolId] = normalizeBonusSchedule(schedules[poolId]);
  }
  const values = NETWORK_POOL_IDS.map((poolId) => normalized[poolId]);
  const allEqual = values.every(
    (value) =>
      value.bps === values[0].bps &&
      value.startsAt === values[0].startsAt &&
      value.endsAt === values[0].endsAt,
  );
  const compatibility = allEqual
    ? values[0]
    : { bps: 10_000, startsAt: 0, endsAt: 0 };
  await db
    .prepare(
      `UPDATE network_runtime_settings
       SET reward_bonus_bps = ?, reward_bonus_starts_at = ?,
           reward_bonus_ends_at = ?, reward_bonus_schedule_json = ?,
           updated_at = ?, updated_by = ?
       WHERE singleton_id = 1`,
    )
    .bind(
      compatibility.bps,
      compatibility.startsAt,
      compatibility.endsAt,
      JSON.stringify(normalized),
      now,
      actorAccountId,
    )
    .run();
}

export async function readNetworkPowerSnapshot(
  db: D1Database,
  now: number,
): Promise<NetworkPowerSnapshot> {
  await ensureNetworkSchema(db);
  await backfillAccountNetworkPower(db, now);
  const [settings, playerPowerGh] = await Promise.all([
    db
      .prepare(
        `SELECT base_cma_gh, base_btc_gh, base_doge_gh, base_ltc_gh,
                reward_cma_atomic, reward_btc_atomic, reward_doge_atomic,
                reward_ltc_atomic,
                reward_bonus_bps, reward_bonus_starts_at,
                reward_bonus_ends_at, reward_bonus_schedule_json, updated_at
         FROM network_runtime_settings
         WHERE singleton_id = 1`,
      )
      .first<NetworkSettingsRow>(),
    readIndexedPlayerPower(db, now),
  ]);
  const basePowerGh: NetworkPowerMap = {
    cma: safePower(settings?.base_cma_gh),
    btc: safePower(settings?.base_btc_gh),
    doge: safePower(settings?.base_doge_gh),
    ltc: safePower(settings?.base_ltc_gh),
  };
  const totalPowerGh: NetworkPowerMap = {
    cma: basePowerGh.cma + playerPowerGh.cma,
    btc: basePowerGh.btc + playerPowerGh.btc,
    doge: basePowerGh.doge + playerPowerGh.doge,
    ltc: basePowerGh.ltc + playerPowerGh.ltc,
  };
  const baseBlockRewardAtomic: BlockRewardMap = {
    cma: safePower(settings?.reward_cma_atomic),
    btc: safePower(settings?.reward_btc_atomic),
    doge: safePower(settings?.reward_doge_atomic),
    ltc: safePower(settings?.reward_ltc_atomic),
  };
  const bonusStartsAt = safePower(settings?.reward_bonus_starts_at);
  const bonusEndsAt = safePower(settings?.reward_bonus_ends_at);
  const bonusSchedules = readBonusSchedules(settings);
  const upcomingSchedules = NETWORK_POOL_IDS
    .map((poolId) => bonusSchedules[poolId])
    .filter((schedule) => schedule.bps > 10_000 && schedule.endsAt > now);
  const activeSchedules = upcomingSchedules.filter(
    (schedule) => schedule.startsAt <= now,
  );
  const bonusActive = activeSchedules.length > 0;
  const bonusBps = upcomingSchedules.length > 0
    ? Math.max(...upcomingSchedules.map((schedule) => schedule.bps))
    : 10_000;
  const effectiveBonusStartsAt = upcomingSchedules.length > 0
    ? Math.min(...upcomingSchedules.map((schedule) => schedule.startsAt))
    : bonusStartsAt;
  const effectiveBonusEndsAt = upcomingSchedules.length > 0
    ? Math.max(...upcomingSchedules.map((schedule) => schedule.endsAt))
    : bonusEndsAt;
  const blockRewardAtomic: BlockRewardMap = {
    cma: Math.floor(
      (baseBlockRewardAtomic.cma *
        (bonusSchedules.cma.startsAt <= now && bonusSchedules.cma.endsAt > now
          ? bonusSchedules.cma.bps
          : 10_000)) /
        10_000,
    ),
    btc: Math.floor(
      (baseBlockRewardAtomic.btc *
        (bonusSchedules.btc.startsAt <= now && bonusSchedules.btc.endsAt > now
          ? bonusSchedules.btc.bps
          : 10_000)) /
        10_000,
    ),
    doge: Math.floor(
      (baseBlockRewardAtomic.doge *
        (bonusSchedules.doge.startsAt <= now && bonusSchedules.doge.endsAt > now
          ? bonusSchedules.doge.bps
          : 10_000)) /
        10_000,
    ),
    ltc: Math.floor(
      (baseBlockRewardAtomic.ltc *
        (bonusSchedules.ltc.startsAt <= now && bonusSchedules.ltc.endsAt > now
          ? bonusSchedules.ltc.bps
          : 10_000)) /
        10_000,
    ),
  };

  return {
    basePowerGh,
    playerPowerGh,
    totalPowerGh,
    baseBlockRewardAtomic,
    blockRewardAtomic,
    bonusActive,
    bonusBps,
    bonusStartsAt: effectiveBonusStartsAt,
    bonusEndsAt: effectiveBonusEndsAt,
    bonusSchedules,
    testMode: Object.values(basePowerGh).every((value) => value === 0),
    updatedAt: Number(settings?.updated_at ?? 0),
  };
}

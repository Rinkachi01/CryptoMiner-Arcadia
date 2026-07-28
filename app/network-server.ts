import {
  getInstalledPower,
  pools,
  type PoolId,
} from "./game-rules.ts";
import type {
  PoolAllocations,
  PublicGameState,
} from "./game-server.ts";

export type NetworkPowerMap = Record<PoolId, number>;

export type NetworkPowerSnapshot = {
  basePowerGh: NetworkPowerMap;
  economicFloorGh: NetworkPowerMap;
  playerPowerGh: NetworkPowerMap;
  totalPowerGh: NetworkPowerMap;
  testMode: boolean;
  updatedAt: number;
};

type NetworkSettingsRow = {
  base_btc_gh: number;
  base_cma_gh: number;
  base_doge_gh: number;
  updated_at: number;
};

type NetworkStateRow = {
  account_id: string;
  state_json: string;
};

type TemporaryPowerRow = {
  account_id: string;
  power_gh: number;
};

export const DEFAULT_NETWORK_BASE_POWER: NetworkPowerMap = {
  cma: pools.find((pool) => pool.id === "cma")?.networkPowerGh ?? 0,
  btc: pools.find((pool) => pool.id === "btc")?.networkPowerGh ?? 0,
  doge: pools.find((pool) => pool.id === "doge")?.networkPowerGh ?? 0,
};

export const ZERO_NETWORK_POWER: NetworkPowerMap = {
  cma: 0,
  btc: 0,
  doge: 0,
};

function safePower(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function validAllocations(value: unknown): PoolAllocations {
  if (!value || typeof value !== "object") {
    return { cma: 100, btc: 0, doge: 0 };
  }
  const candidate = value as Partial<PoolAllocations>;
  const cma = safePower(candidate.cma);
  const btc = safePower(candidate.btc);
  const doge = safePower(candidate.doge);
  return cma + btc + doge === 100
    ? { cma, btc, doge }
    : { cma: 100, btc: 0, doge: 0 };
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
  const totals: NetworkPowerMap = { cma: 0, btc: 0, doge: 0 };

  for (const entry of states) {
    if (safePower(entry.state.energyExpiresAt) <= now) continue;
    const installed = Object.values(entry.state.rackMiners ?? {}).flat();
    const power =
      getInstalledPower(installed) +
      safePower(temporaryPowerByAccount.get(entry.accountId));
    const allocations = validAllocations(entry.state.poolAllocations);
    for (const pool of pools) {
      totals[pool.id] += Math.floor((power * allocations[pool.id]) / 100);
    }
  }

  return totals;
}

export async function ensureNetworkSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS network_runtime_settings (
        singleton_id INTEGER PRIMARY KEY NOT NULL,
        base_cma_gh INTEGER DEFAULT 60000000 NOT NULL,
        base_btc_gh INTEGER DEFAULT 1800000 NOT NULL,
        base_doge_gh INTEGER DEFAULT 4000000 NOT NULL,
        updated_at INTEGER DEFAULT 0 NOT NULL,
        updated_by TEXT
      )`,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO network_runtime_settings (
        singleton_id, base_cma_gh, base_btc_gh, base_doge_gh, updated_at
      ) VALUES (1, ?, ?, ?, 0)`,
    )
    .bind(
      DEFAULT_NETWORK_BASE_POWER.cma,
      DEFAULT_NETWORK_BASE_POWER.btc,
      DEFAULT_NETWORK_BASE_POWER.doge,
    )
    .run();
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
       SET base_cma_gh = ?, base_btc_gh = ?, base_doge_gh = ?,
           updated_at = ?, updated_by = ?
       WHERE singleton_id = 1`,
    )
    .bind(
      safePower(values.cma),
      safePower(values.btc),
      safePower(values.doge),
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
  const [settings, stateRows, temporaryRows] = await Promise.all([
    db
      .prepare(
        `SELECT base_cma_gh, base_btc_gh, base_doge_gh, updated_at
         FROM network_runtime_settings
         WHERE singleton_id = 1`,
      )
      .first<NetworkSettingsRow>(),
    db
      .prepare(
        `SELECT account_id, state_json
         FROM game_states
         LIMIT 5000`,
      )
      .all<NetworkStateRow>(),
    db
      .prepare(
        `SELECT account_id, COALESCE(SUM(power_gh), 0) AS power_gh
         FROM temporary_power_grants
         WHERE starts_at <= ? AND expires_at > ?
         GROUP BY account_id`,
      )
      .bind(now, now)
      .all<TemporaryPowerRow>(),
  ]);

  const states: Array<{
    accountId: string;
    state: Pick<
      PublicGameState,
      "energyExpiresAt" | "poolAllocations" | "rackMiners"
    >;
  }> = [];
  for (const row of stateRows.results ?? []) {
    try {
      const state = JSON.parse(row.state_json) as PublicGameState;
      states.push({
        accountId: row.account_id,
        state,
      });
    } catch {
      // Estados legados inválidos não participam do poder vivo.
    }
  }

  const temporaryPower = new Map(
    (temporaryRows.results ?? []).map((row) => [
      row.account_id,
      safePower(row.power_gh),
    ]),
  );
  const playerPowerGh = aggregatePlayerNetworkPower(
    states,
    temporaryPower,
    now,
  );
  const basePowerGh: NetworkPowerMap = {
    cma: safePower(settings?.base_cma_gh),
    btc: safePower(settings?.base_btc_gh),
    doge: safePower(settings?.base_doge_gh),
  };
  const totalPowerGh: NetworkPowerMap = {
    cma: basePowerGh.cma + playerPowerGh.cma,
    btc: basePowerGh.btc + playerPowerGh.btc,
    doge: basePowerGh.doge + playerPowerGh.doge,
  };

  return {
    basePowerGh,
    economicFloorGh: { ...DEFAULT_NETWORK_BASE_POWER },
    playerPowerGh,
    totalPowerGh,
    testMode: Object.values(basePowerGh).every((value) => value === 0),
    updatedAt: Number(settings?.updated_at ?? 0),
  };
}

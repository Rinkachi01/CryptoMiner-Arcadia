import { readAdminRuntimeSettings } from "./admin-settings.ts";

export const DAILY_GAME_POWER_BUDGET_GH = 5_000;

export type GameEmissionBudget = {
  awardedPowerGh: number;
  budgetPowerGh: number;
  limited: boolean;
  paused: boolean;
  remainingPowerGh: number;
  requestedPowerGh: number;
  resetAt: number;
  usagePercent: number;
  usedPowerGh: number;
  windowKey: string;
};

type BudgetRow = {
  granted_power_gh: number;
};

export function emissionWindow(now: number) {
  const date = new Date(now);
  const windowKey = date.toISOString().slice(0, 10);
  const resetAt = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return { resetAt, windowKey };
}

export function calculateEmissionAward(
  usedPowerGh: number,
  requestedPowerGh: number,
  budgetPowerGh = DAILY_GAME_POWER_BUDGET_GH,
) {
  const safeUsed = Math.max(0, Math.floor(usedPowerGh));
  const safeRequested = Math.max(0, Math.floor(requestedPowerGh));
  const remainingBeforeAward = Math.max(0, budgetPowerGh - safeUsed);
  return Math.min(safeRequested, remainingBeforeAward);
}

export async function ensureEmissionBudgetSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS game_emission_budgets (
        account_id TEXT NOT NULL,
        window_key TEXT NOT NULL,
        granted_power_gh INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, window_key)
      )`,
    )
    .run();
}

async function ensureBudgetRow(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const { resetAt, windowKey } = emissionWindow(now);
  const windowStart = resetAt - 24 * 60 * 60 * 1000;
  const existingRewards = await db
    .prepare(
      `SELECT COALESCE(SUM(reward_power_gh), 0) AS total
       FROM game_sessions
       WHERE account_id = ? AND status = 'completed'
         AND completed_at >= ? AND completed_at < ?`,
    )
    .bind(accountId, windowStart, resetAt)
    .first<{ total: number }>();
  const baseline = Math.min(
    DAILY_GAME_POWER_BUDGET_GH,
    Math.max(0, Number(existingRewards?.total ?? 0)),
  );
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_emission_budgets (
        account_id, window_key, granted_power_gh, updated_at
      ) VALUES (?, ?, ?, ?)`,
    )
    .bind(accountId, windowKey, baseline, now)
    .run();
}

function budgetPayload(
  usedPowerGh: number,
  requestedPowerGh: number,
  awardedPowerGh: number,
  now: number,
  paused = false,
): GameEmissionBudget {
  const { resetAt, windowKey } = emissionWindow(now);
  const safeUsed = Math.max(0, Math.floor(usedPowerGh));
  return {
    awardedPowerGh,
    budgetPowerGh: DAILY_GAME_POWER_BUDGET_GH,
    limited: awardedPowerGh < Math.max(0, Math.floor(requestedPowerGh)),
    paused,
    remainingPowerGh: Math.max(
      0,
      DAILY_GAME_POWER_BUDGET_GH - safeUsed,
    ),
    requestedPowerGh: Math.max(0, Math.floor(requestedPowerGh)),
    resetAt,
    usagePercent: Math.min(
      100,
      Math.floor((safeUsed / DAILY_GAME_POWER_BUDGET_GH) * 100),
    ),
    usedPowerGh: safeUsed,
    windowKey,
  };
}

export async function readDailyGamePowerBudget(
  db: D1Database,
  accountId: string,
  now: number,
) {
  await ensureEmissionBudgetSchema(db);
  const { windowKey } = emissionWindow(now);
  await ensureBudgetRow(db, accountId, now);
  const row = await db
    .prepare(
      `SELECT granted_power_gh
       FROM game_emission_budgets
       WHERE account_id = ? AND window_key = ?`,
    )
    .bind(accountId, windowKey)
    .first<BudgetRow>();
  return budgetPayload(Number(row?.granted_power_gh ?? 0), 0, 0, now);
}

export async function reserveDailyGamePower(
  db: D1Database,
  accountId: string,
  requestedPowerGh: number,
  now: number,
) {
  await ensureEmissionBudgetSchema(db);
  const { windowKey } = emissionWindow(now);
  const requested = Math.max(0, Math.floor(requestedPowerGh));
  await ensureBudgetRow(db, accountId, now);
  const settings = await readAdminRuntimeSettings(db);
  if (!settings.minigamePowerEnabled) {
    const current = await readDailyGamePowerBudget(db, accountId, now);
    return {
      ...current,
      limited: requested > 0,
      paused: true,
      requestedPowerGh: requested,
    };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await db
      .prepare(
        `SELECT granted_power_gh
         FROM game_emission_budgets
         WHERE account_id = ? AND window_key = ?`,
      )
      .bind(accountId, windowKey)
      .first<BudgetRow>();
    const used = Number(row?.granted_power_gh ?? 0);
    const awarded = calculateEmissionAward(used, requested);

    if (awarded <= 0) {
      return budgetPayload(used, requested, 0, now);
    }

    const update = await db
      .prepare(
        `UPDATE game_emission_budgets
         SET granted_power_gh = granted_power_gh + ?, updated_at = ?
         WHERE account_id = ? AND window_key = ?
           AND granted_power_gh = ?`,
      )
      .bind(awarded, now, accountId, windowKey, used)
      .run();

    if ((update.meta.changes ?? 0) === 1) {
      return budgetPayload(used + awarded, requested, awarded, now);
    }
  }

  const current = await readDailyGamePowerBudget(db, accountId, now);
  return {
    ...current,
    limited: requested > 0,
    requestedPowerGh: requested,
  };
}

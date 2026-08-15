import { dailyBoundariesBetween, DAY_MS } from "./daily-reset-rules.ts";

export const ARCADE_DIFFICULTY_MAX = 5;
export const ARCADE_POWER_DAYS_BY_LEVEL = [0, 1, 2, 3, 5, 7] as const;

export function normalizeArcadeDifficulty(value: number) {
  return Math.max(1, Math.min(ARCADE_DIFFICULTY_MAX, Math.floor(value || 1)));
}

export function nextArcadeDifficulty(value: number) {
  return Math.min(ARCADE_DIFFICULTY_MAX, normalizeArcadeDifficulty(value) + 1);
}

export function arcadePowerDurationDays(value: number) {
  return ARCADE_POWER_DAYS_BY_LEVEL[normalizeArcadeDifficulty(value)];
}

export function arcadePowerExpiresAt(now: number, difficulty: number) {
  return now + arcadePowerDurationDays(difficulty) * DAY_MS;
}

export function arcadeDifficultyAfterInactivity(
  difficulty: number,
  lastActivityAt: number,
  now: number,
) {
  const level = normalizeArcadeDifficulty(difficulty);
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0 || now <= lastActivityAt) {
    return level;
  }
  const inactiveDays = dailyBoundariesBetween(lastActivityAt, now);
  return Math.max(1, level - inactiveDays);
}

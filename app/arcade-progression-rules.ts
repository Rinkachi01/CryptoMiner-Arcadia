import { dailyBoundariesBetween, DAY_MS } from "./daily-reset-rules.ts";

export const ARCADE_DIFFICULTY_MAX = 5;
// The PC level is the source of truth for a grant's lifetime. Each grant
// stores its own `expires_at`, so a reward keeps the duration of the level
// that was active when it was validated, even after the PC progresses.
export const ARCADE_POWER_DAYS_BY_LEVEL = [0, 1, 2, 3, 4, 5] as const;

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

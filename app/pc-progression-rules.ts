import { dailyWindowIndex } from "./daily-reset-rules.ts";

// Smooth progression calibrated against the four-game daily allowance. The
// final level is reachable in roughly two active cycles without changing the
// amount of power emitted by a validated game.
const PC_PLAY_THRESHOLDS = [0, 8, 24, 48, 80, 120] as const;

export function pcLevelForPlays(totalPlays: number): number {
  const plays = Math.max(0, Math.floor(Number.isFinite(totalPlays) ? totalPlays : 0));
  let level = 0;
  for (let index = 1; index < PC_PLAY_THRESHOLDS.length; index += 1) {
    if (plays < PC_PLAY_THRESHOLDS[index]) break;
    level = index;
  }
  return level;
}

export function pcNextPlayTarget(level: number): number {
  const safeLevel = Math.max(0, Math.min(PC_PLAY_THRESHOLDS.length - 1, Math.floor(level)));
  return PC_PLAY_THRESHOLDS[safeLevel];
}

export function pcProgressPercent(totalPlays: number, level: number): number {
  const safeLevel = Math.max(0, Math.min(PC_PLAY_THRESHOLDS.length - 1, Math.floor(level)));
  if (safeLevel >= PC_PLAY_THRESHOLDS.length - 1) return 100;
  const start = PC_PLAY_THRESHOLDS[safeLevel];
  const end = PC_PLAY_THRESHOLDS[safeLevel + 1];
  const plays = Math.max(0, Math.floor(Number.isFinite(totalPlays) ? totalPlays : 0));
  return Math.max(0, Math.min(100, Math.round(((plays - start) / (end - start)) * 100)));
}

/**
 * A PC cycle is only valid when the player records at least one win in that
 * cycle. If the cycle closes without a validated win, the next authoritative
 * read resets the PC completely so the player must build it again from zero.
 */
export function pcResetRequired(
  totalPlays: number,
  lastActivityAt: number,
  lastWinAt: number,
  now: number,
) {
  const plays = Math.max(0, Math.floor(Number.isFinite(totalPlays) ? totalPlays : 0));
  if (plays <= 0 || !Number.isFinite(lastActivityAt) || lastActivityAt <= 0 || now <= lastActivityAt) {
    return false;
  }

  const currentWindow = dailyWindowIndex(now);
  const activityWindow = dailyWindowIndex(lastActivityAt);
  if (activityWindow >= currentWindow) return false;

  // A second untouched boundary is conclusive even if older records are
  // incomplete. Otherwise, inspect the cycle in which the player last acted.
  if (currentWindow - activityWindow >= 2) return true;
  const winWindow =
    Number.isFinite(lastWinAt) && lastWinAt > 0 ? dailyWindowIndex(lastWinAt) : -1;
  return winWindow !== activityWindow;
}

export function pcLevelAfterInactivity(
  totalPlays: number,
  lastActivityAt: number,
  lastWinAt: number,
  now: number,
) {
  const earnedLevel = pcLevelForPlays(totalPlays);
  return pcResetRequired(totalPlays, lastActivityAt, lastWinAt, now)
    ? 0
    : earnedLevel;
}

export const PC_PLAY_THRESHOLDS_EXPORT = PC_PLAY_THRESHOLDS;

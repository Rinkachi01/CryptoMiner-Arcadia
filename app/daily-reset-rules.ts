/**
 * Arcadia's daily window starts at 21:00 in the operator's reference timezone
 * (America/Araguaina, UTC-03:00). We keep the boundary in UTC so every
 * Worker, browser and scheduled job agrees on the same window.
 */
export const DAILY_RESET_HOUR_LOCAL = 21;
export const DAILY_RESET_OFFSET_UTC_HOURS = 3;
export const DAILY_RESET_HOUR_UTC =
  (DAILY_RESET_HOUR_LOCAL + DAILY_RESET_OFFSET_UTC_HOURS) % 24;
// 21:00 in UTC-03:00 is 00:00 UTC. Keep the unwrapped offset for the
// shifted-day calculation so the window key remains the local calendar day.
export const DAILY_RESET_OFFSET_MS =
  (DAILY_RESET_HOUR_LOCAL + DAILY_RESET_OFFSET_UTC_HOURS) * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

function safeTimestamp(now: number) {
  return Number.isFinite(now) ? now : Date.now();
}

export function dailyWindowIndex(now: number) {
  return Math.floor((safeTimestamp(now) - DAILY_RESET_OFFSET_MS) / DAY_MS);
}

export function dailyWindowKey(now: number) {
  const shifted = new Date(
    dailyWindowIndex(now) * DAY_MS + DAILY_RESET_OFFSET_MS,
  );
  return shifted.toISOString().slice(0, 10);
}

export function dailyResetWindow(now: number) {
  const index = dailyWindowIndex(now);
  const startsAt = index * DAY_MS + DAILY_RESET_OFFSET_MS;
  return {
    index,
    windowKey: dailyWindowKey(now),
    startsAt,
    resetAt: startsAt + DAY_MS,
  };
}

export function dailyBoundariesBetween(start: number, end: number) {
  return Math.max(0, dailyWindowIndex(end) - dailyWindowIndex(start));
}

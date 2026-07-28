import { emissionWindow } from "./game-emission-budget.ts";

export const DAILY_ARCADE_MISSION_ID = "arcade-tour";
export const DAILY_ARCADE_BATTERY_REWARD = 1;
export const DAILY_ARCADE_GAMES = [
  "packet-catch",
  "hash-match",
  "circuit-rush",
] as const;

export type DailyArcadeGameId = (typeof DAILY_ARCADE_GAMES)[number];

export function dailyMissionWindow(now: number) {
  const { resetAt, windowKey } = emissionWindow(now);
  return {
    resetAt,
    windowKey,
    startsAt: resetAt - 24 * 60 * 60 * 1000,
  };
}

export function completedDailyArcadeGames(gameIds: Iterable<string>) {
  const played = new Set(gameIds);
  return DAILY_ARCADE_GAMES.filter((gameId) => played.has(gameId));
}

export function isDailyArcadeMissionEligible(gameIds: Iterable<string>) {
  return completedDailyArcadeGames(gameIds).length === DAILY_ARCADE_GAMES.length;
}

export function dailyMissionIdempotencyKey(windowKey: string) {
  return `mission:${DAILY_ARCADE_MISSION_ID}:${windowKey}`;
}

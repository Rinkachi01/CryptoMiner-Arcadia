export const DEFAULT_SEASON_DURATION_DAYS = 30;
export const MIN_SEASON_DURATION_DAYS = 7;
export const MAX_SEASON_DURATION_DAYS = 90;

export type SeasonScoreInput = {
  highestDifficulty: number;
  plays: number;
  wins: number;
};

export function calculateSeasonScore(input: SeasonScoreInput) {
  const plays = Math.max(0, Math.floor(input.plays));
  const wins = Math.max(0, Math.min(plays, Math.floor(input.wins)));
  const highestDifficulty = Math.max(
    0,
    Math.min(100, Math.floor(input.highestDifficulty)),
  );
  return plays * 10 + wins * 100 + highestDifficulty * 25;
}

export function seasonProgressPercent(
  startsAt: number,
  endsAt: number,
  now: number,
) {
  const duration = Math.max(1, endsAt - startsAt);
  return Math.max(
    0,
    Math.min(100, Math.round(((now - startsAt) / duration) * 100)),
  );
}

export function normalizeSeasonDurationDays(value: number) {
  return Math.max(
    MIN_SEASON_DURATION_DAYS,
    Math.min(MAX_SEASON_DURATION_DAYS, Math.floor(value)),
  );
}

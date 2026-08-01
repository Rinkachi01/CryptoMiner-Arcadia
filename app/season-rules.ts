export const DEFAULT_SEASON_DURATION_DAYS = 30;
export const MIN_SEASON_DURATION_DAYS = 7;
export const MAX_SEASON_DURATION_DAYS = 90;

export type SeasonScoreInput = {
  highestDifficulty: number;
  plays: number;
  wins: number;
};

export type ComparableSeasonSnapshot = {
  createdAt: number;
  metrics: Record<string, number>;
};

function metric(metrics: Record<string, number>, key: string) {
  const value = Number(metrics[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function compareSeasonSnapshots(
  snapshots: ComparableSeasonSnapshot[],
) {
  if (snapshots.length < 2) return null;
  const ordered = [...snapshots].sort(
    (first, second) => first.createdAt - second.createdAt,
  );
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return {
    activePlayers24hDelta:
      metric(last.metrics, "activePlayers24h") -
      metric(first.metrics, "activePlayers24h"),
    fromAt: first.createdAt,
    games24hDelta:
      metric(last.metrics, "games24h") - metric(first.metrics, "games24h"),
    powerGranted24hDelta:
      metric(last.metrics, "powerGranted24h") -
      metric(first.metrics, "powerGranted24h"),
    toAt: last.createdAt,
    totalPlayersDelta:
      metric(last.metrics, "totalPlayers") -
      metric(first.metrics, "totalPlayers"),
  };
}

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

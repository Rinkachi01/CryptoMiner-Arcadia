import { assetsManifest } from "./assets.manifest.ts";

export const DEFAULT_SEASON_DURATION_DAYS = 30;
export const MIN_SEASON_DURATION_DAYS = 7;
export const MAX_SEASON_DURATION_DAYS = 180;

export const SPACE_RACE_SEASON_ID = "season-space-race-01";
export const SPACE_RACE_SLUG = "space-race-01";
export const SPACE_RACE_DURATION_DAYS = 120;
export const SPACE_RACE_LEVELS = 50;
export const SPACE_RACE_PREMIUM_PRICE_CMA = 29;

export const SEASON_LOGIN_XP = 50;
export const SEASON_GAME_XP = 20;
export const SEASON_DAILY_GAME_XP_CAP = 100;
export const SEASON_SPEND_XP_PER_CMA = 5;
export const SEASON_DAILY_SPEND_XP_CAP = 50;

export type SeasonTrack = "free" | "premium";

export type SeasonReward = {
  asset: string;
  level: number;
  reward:
    | { type: "battery"; quantity: number }
    | { type: "miner"; minerId: string; quantity: 1 }
    | { type: "power"; days: 1 | 3 | 7; powerGh: number };
  title: string;
  track: SeasonTrack;
};

export const spaceRaceRewards: SeasonReward[] = [
  { level: 2, track: "free", title: "2 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 2 } },
  { level: 5, track: "free", title: "250 GH/s por 1 dia", asset: assetsManifest.spaceSatellite.path, reward: { type: "power", powerGh: 250, days: 1 } },
  { level: 10, track: "free", title: "Lunar Rover", asset: assetsManifest.spaceRover.path, reward: { type: "miner", minerId: "lunar-rover-s1", quantity: 1 } },
  { level: 15, track: "free", title: "2 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 2 } },
  { level: 20, track: "free", title: "400 GH/s por 3 dias", asset: assetsManifest.spaceSkiff.path, reward: { type: "power", powerGh: 400, days: 3 } },
  { level: 30, track: "free", title: "Relay Satellite", asset: assetsManifest.spaceSatellite.path, reward: { type: "miner", minerId: "relay-satellite-s1", quantity: 1 } },
  { level: 40, track: "free", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 50, track: "free", title: "600 GH/s por 7 dias", asset: assetsManifest.spaceStation.path, reward: { type: "power", powerGh: 600, days: 7 } },

  { level: 1, track: "premium", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 5, track: "premium", title: "Comet Skiff", asset: assetsManifest.spaceSkiff.path, reward: { type: "miner", minerId: "comet-skiff-s1", quantity: 1 } },
  { level: 8, track: "premium", title: "500 GH/s por 1 dia", asset: assetsManifest.spaceCruiser.path, reward: { type: "power", powerGh: 500, days: 1 } },
  { level: 10, track: "premium", title: "Star Scout", asset: assetsManifest.spaceScout.path, reward: { type: "miner", minerId: "star-scout-s1", quantity: 1 } },
  { level: 14, track: "premium", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 18, track: "premium", title: "Orbit Drill", asset: assetsManifest.spaceDrill.path, reward: { type: "miner", minerId: "orbit-drill-s1", quantity: 1 } },
  { level: 22, track: "premium", title: "750 GH/s por 3 dias", asset: assetsManifest.spaceFreighter.path, reward: { type: "power", powerGh: 750, days: 3 } },
  { level: 26, track: "premium", title: "Void Freighter", asset: assetsManifest.spaceFreighter.path, reward: { type: "miner", minerId: "void-freighter-s1", quantity: 1 } },
  { level: 32, track: "premium", title: "4 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 4 } },
  { level: 36, track: "premium", title: "Plasma Cruiser", asset: assetsManifest.spaceCruiser.path, reward: { type: "miner", minerId: "plasma-cruiser-s1", quantity: 1 } },
  { level: 42, track: "premium", title: "1.000 GH/s por 7 dias", asset: assetsManifest.spaceStation.path, reward: { type: "power", powerGh: 1_000, days: 7 } },
  { level: 46, track: "premium", title: "Arcadia Station", asset: assetsManifest.spaceStation.path, reward: { type: "miner", minerId: "arcadia-station-s1", quantity: 1 } },
  { level: 50, track: "premium", title: "1.200 GH/s por 7 dias", asset: assetsManifest.spaceStation.path, reward: { type: "power", powerGh: 1_200, days: 7 } },
];

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

export function seasonXpRequiredForLevel(level: number) {
  const normalized = Math.max(1, Math.min(SPACE_RACE_LEVELS, Math.floor(level)));
  const completedSteps = normalized - 1;
  return (
    130 * completedSteps +
    (5 * completedSteps * (completedSteps - 1)) / 2
  );
}

export function seasonLevelForXp(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (
    level < SPACE_RACE_LEVELS &&
    safeXp >= seasonXpRequiredForLevel(level + 1)
  ) {
    level += 1;
  }
  return level;
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

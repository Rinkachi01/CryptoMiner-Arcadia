import { assetsManifest } from "./assets.manifest.ts";
import {
  partAssetPath,
  type PartFamily,
  type PartRarity,
} from "./parts-rules.ts";

export const DEFAULT_SEASON_DURATION_DAYS = 30;
export const MIN_SEASON_DURATION_DAYS = 7;
export const MAX_SEASON_DURATION_DAYS = 180;

export const SPACE_RACE_SEASON_ID = "season-space-race-01";
export const SPACE_RACE_SLUG = "space-race-01";
export const SPACE_RACE_DURATION_DAYS = 120;
export const SPACE_RACE_LEVELS = 50;
export const SPACE_RACE_PREMIUM_PRICE_CMA = 29;
export const SPACE_RACE_PREMIUM_MAX_PRICE_CMA = 100;

/**
 * Welcome-pass rollout: the first public pass is free and keeps the legacy
 * reward rows/claim keys so existing redemptions remain idempotent.
 */
export const SPACE_RACE_WELCOME_PASS = true;
export const SPACE_RACE_WELCOME_XP_BUNDLE = 300;

/** Temporada 02 — tema Alquimia Mágica (staging-first rollout). */
export const ALCHEMY_SEASON_ID = "season-alchemy-magic-02";
export const ALCHEMY_SEASON_SLUG = "alchemy-magic-02";
export const ALCHEMY_SEASON_DURATION_DAYS = 70;
export const ALCHEMY_SEASON_LEVELS = 60;
export const ALCHEMY_SEASON_PREMIUM_PRICE_CMA = 100;
export const ALCHEMY_SEASON_PREMIUM_MAX_PRICE_CMA = 300;

export function seasonPricePolicyForCampaign(campaignSlug: string): SeasonPricePolicy {
  return campaignSlug === ALCHEMY_SEASON_SLUG
    ? {
        premiumPriceCma: ALCHEMY_SEASON_PREMIUM_PRICE_CMA,
        premiumMaxPriceCma: ALCHEMY_SEASON_PREMIUM_MAX_PRICE_CMA,
      }
    : {
        premiumPriceCma: SPACE_RACE_PREMIUM_PRICE_CMA,
        premiumMaxPriceCma: SPACE_RACE_PREMIUM_MAX_PRICE_CMA,
      };
}

/** Campaign-specific pass length. Legacy Space Race stays at 50 levels. */
export function seasonLevelsForCampaign(campaignSlug: string) {
  return campaignSlug === ALCHEMY_SEASON_SLUG
    ? ALCHEMY_SEASON_LEVELS
    : SPACE_RACE_LEVELS;
}

export function seasonBannerPathForCampaign(campaignSlug: string) {
  return campaignSlug === ALCHEMY_SEASON_SLUG
    ? "/assets/seasons/alchemy/banner.png"
    : "/assets/season/space-race/banner.png";
}

export type SeasonPricePolicy = {
  premiumPriceCma: number;
  premiumMaxPriceCma: number;
};

export function seasonPremiumMaxPriceCma(
  level: number,
  premiumUnlocked: boolean,
  policy: SeasonPricePolicy = {
    premiumPriceCma: SPACE_RACE_PREMIUM_PRICE_CMA,
    premiumMaxPriceCma: SPACE_RACE_PREMIUM_MAX_PRICE_CMA,
  },
  maxLevel = SPACE_RACE_LEVELS,
) {
  const normalizedLevel = Math.max(
    1,
    Math.min(maxLevel, Math.floor(level || 1)),
  );
  const completedLevelDiscount = Math.floor((normalizedLevel - 1) * 1.42);
  const premiumDiscount = premiumUnlocked ? policy.premiumPriceCma : 0;
  return Math.max(
    1,
    policy.premiumMaxPriceCma -
      premiumDiscount -
      completedLevelDiscount,
  );
}

export const SEASON_LOGIN_XP = 50;
export const SEASON_DAILY_LOGIN_XP = [20, 30, 40, 50, 60, 80, 100] as const;
export const SEASON_GAME_XP = 20;
export const SEASON_DAILY_GAME_XP_CAP = 100;
export const SEASON_SPEND_XP_PER_CMA = 5;
export const SEASON_DAILY_SPEND_XP_CAP = 50;

export type SeasonTrack = "free" | "premium";

export type SeasonReward = {
  asset: string;
  /** Original key retained so the unified welcome lane remains idempotent. */
  claimLevel?: number;
  claimTrack?: SeasonTrack;
  level: number;
  reward:
    | { type: "battery"; quantity: number }
    | { type: "miner"; minerId: string; quantity: 1; minerLevel?: number }
    | { type: "rack"; quantity: number }
    | { type: "power"; days: 1 | 3 | 7; powerGh: number }
    | { type: "hack"; days: 1 | 3 | 7; powerGh: number }
    | { type: "parts"; family: PartFamily; rarity: PartRarity; quantity: number }
    | { type: "season_currency"; quantity: number };
  title: string;
  track: SeasonTrack;
};

/** O XP é compartilhado; o passe Max só amplia o acesso às recompensas. */
export function isSeasonRewardUnlocked(
  playerLevel: number,
  rewardLevel: number,
  maxUnlocked = false,
) {
  return maxUnlocked || playerLevel >= rewardLevel;
}

export function isSeasonTrackUnlocked(
  track: SeasonTrack,
  premiumUnlocked: boolean,
  maxUnlocked = false,
) {
  return track === "free" || premiumUnlocked || maxUnlocked;
}

export const spaceRaceRewards: SeasonReward[] = [
  { level: 2, track: "free", title: "2 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 2 } },
  { level: 3, track: "free", title: "50 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 50 } },
  { level: 5, track: "free", title: "250 GH/s por 1 dia", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 250, days: 1 } },
  { level: 10, track: "free", title: "Lunar Rover", asset: assetsManifest.spaceRover.path, reward: { type: "miner", minerId: "lunar-rover-s1", quantity: 1 } },
  { level: 15, track: "free", title: "2 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 2 } },
  { level: 20, track: "free", title: "400 GH/s por 3 dias", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 400, days: 3 } },
  { level: 24, track: "free", title: "100 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 100 } },
  { level: 30, track: "free", title: "Relay Satellite", asset: assetsManifest.spaceSatellite.path, reward: { type: "miner", minerId: "relay-satellite-s1", quantity: 1 } },
  { level: 40, track: "free", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 43, track: "free", title: "150 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 150 } },
  { level: 50, track: "free", title: "600 GH/s por 7 dias", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 600, days: 7 } },

  { level: 1, track: "premium", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 2, track: "premium", title: "100 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 100 } },
  { level: 5, track: "premium", title: "Comet Skiff", asset: assetsManifest.spaceSkiff.path, reward: { type: "miner", minerId: "comet-skiff-s1", quantity: 1 } },
  { level: 8, track: "premium", title: "500 GH/s por 1 dia", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 500, days: 1 } },
  { level: 10, track: "premium", title: "Star Scout", asset: assetsManifest.spaceScout.path, reward: { type: "miner", minerId: "star-scout-s1", quantity: 1 } },
  { level: 14, track: "premium", title: "3 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 3 } },
  { level: 16, track: "premium", title: "200 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 200 } },
  { level: 18, track: "premium", title: "Orbit Drill", asset: assetsManifest.spaceDrill.path, reward: { type: "miner", minerId: "orbit-drill-s1", quantity: 1 } },
  { level: 22, track: "premium", title: "750 GH/s por 3 dias", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 750, days: 3 } },
  { level: 26, track: "premium", title: "Void Freighter", asset: assetsManifest.spaceFreighter.path, reward: { type: "miner", minerId: "void-freighter-s1", quantity: 1 } },
  { level: 32, track: "premium", title: "4 baterias", asset: assetsManifest.battery.path, reward: { type: "battery", quantity: 4 } },
  { level: 35, track: "premium", title: "300 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 300 } },
  { level: 36, track: "premium", title: "Plasma Cruiser", asset: assetsManifest.spaceCruiser.path, reward: { type: "miner", minerId: "plasma-cruiser-s1", quantity: 1 } },
  { level: 42, track: "premium", title: "1.000 GH/s por 7 dias", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 1_000, days: 7 } },
  { level: 46, track: "premium", title: "Arcadia Station", asset: assetsManifest.spaceStation.path, reward: { type: "miner", minerId: "arcadia-station-s1", quantity: 1 } },
  { level: 50, track: "premium", title: "1.200 GH/s por 7 dias", asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh: 1_200, days: 7 } },
  { level: 48, track: "premium", title: "500 AMC", asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity: 500 } },
];

/**
 * Seasonal currency is a staging-only mechanic while the welcome pass is
 * being validated. Production must not expose those rewards or accept their
 * claim keys, but keeping the canonical list here lets staging exercise the
 * complete flow without maintaining a second reward table.
 */
export function spaceRaceRewardsForEnvironment(allowSeasonalCurrency = true) {
  return allowSeasonalCurrency
    ? spaceRaceRewards
    : spaceRaceRewards
      .filter((reward) => reward.reward.type !== "season_currency")
      .sort((first, second) =>
        first.level - second.level || (first.track === "free" ? -1 : 1),
      )
      .map((reward, index) => ({
        ...reward,
        claimLevel: reward.level,
        claimTrack: reward.track,
        level: index + 1,
        // The public welcome pass is a single free lane. The original track
        // is kept above only for claim-key compatibility on the server.
        track: "free" as const,
      }));
}

/**
 * Recompensas da segunda temporada. Cada nível tem uma recompensa em cada
 * trilha; o XP continua compartilhado entre Free e Premium.
 */
type AlchemyPassMiner = { id: string; title: string; asset: string; minerLevel: number };

/**
 * Season 2's final miner set comes from the Alchemy Magic art pack.  The
 * first draft used placeholder machines (Apprentice Desk, Soul Lantern,
 * Potion Alembic and Mana Generator); they remain in game-rules.ts only for
 * backwards-compatible rendering of an old inventory, but are not offered by
 * this season anymore.
 */
const alchemyMinerCatalog: Record<string, Omit<AlchemyPassMiner, "minerLevel">> = {
  "alchemy-crystal-s2": { id: "alchemy-crystal-s2", title: "Cristal Flutuante", asset: assetsManifest.alchemyCrystal.path },
  "alchemy-cauldron-s2": { id: "alchemy-cauldron-s2", title: "Caldeirão Mágico", asset: assetsManifest.alchemyCauldron.path },
  "alchemy-orrery-s2": { id: "alchemy-orrery-s2", title: "Orrery Astral", asset: assetsManifest.alchemyOrrery.path },
  "alchemy-spellbook-s2": { id: "alchemy-spellbook-s2", title: "Altar do Grimório", asset: assetsManifest.alchemySpellbook.path },
  "alchemy-tower-s2": { id: "alchemy-tower-s2", title: "Torre do Arcanista", asset: assetsManifest.alchemyTower.path },
};

const freeMinerSchedule: Array<[number, string, number]> = [
  // The free lane contains one seasonal machine only: repeated Crystal
  // drops make it possible to start a merge without giving away the whole
  // collection before the premium lane is unlocked.
  [1, "alchemy-crystal-s2", 1], [4, "alchemy-crystal-s2", 1], [7, "alchemy-crystal-s2", 1],
  [10, "alchemy-crystal-s2", 1], [13, "alchemy-crystal-s2", 1], [16, "alchemy-crystal-s2", 1],
  [19, "alchemy-crystal-s2", 1], [22, "alchemy-crystal-s2", 1], [25, "alchemy-crystal-s2", 1],
  [28, "alchemy-crystal-s2", 1], [31, "alchemy-crystal-s2", 1],
  [40, "alchemy-crystal-s2", 2], [55, "alchemy-crystal-s2", 2],
];

const premiumMinerSchedule: Array<[number, string, number]> = [
  // Four machines exclusive to Premium: 8 C1 drops, 11 C2 drops and one
  // C3 finale, matching the previously approved 20-machine distribution.
  [1, "alchemy-cauldron-s2", 1], [6, "alchemy-cauldron-s2", 1], [11, "alchemy-orrery-s2", 1],
  [16, "alchemy-cauldron-s2", 1], [21, "alchemy-orrery-s2", 1], [26, "alchemy-cauldron-s2", 1],
  [31, "alchemy-orrery-s2", 1], [36, "alchemy-cauldron-s2", 1],
  [39, "alchemy-orrery-s2", 2], [41, "alchemy-spellbook-s2", 2], [43, "alchemy-orrery-s2", 2],
  [45, "alchemy-spellbook-s2", 2], [47, "alchemy-orrery-s2", 2], [49, "alchemy-spellbook-s2", 2],
  [51, "alchemy-orrery-s2", 2], [53, "alchemy-spellbook-s2", 2], [55, "alchemy-orrery-s2", 2],
  [57, "alchemy-spellbook-s2", 2], [59, "alchemy-orrery-s2", 2],
  [60, "alchemy-tower-s2", 3],
];

function minerScheduleMap(schedule: Array<[number, string, number]>) {
  return Object.fromEntries(
    schedule.map(([level, id, minerLevel]) => [
      level,
      { ...alchemyMinerCatalog[id], minerLevel },
    ]),
  ) as Record<number, AlchemyPassMiner>;
}

const alchemyMinerByLevel = minerScheduleMap(freeMinerSchedule);
const alchemyPremiumMinerByLevel = minerScheduleMap(premiumMinerSchedule);

const partFamilies: PartFamily[] = ["hashboard", "fan", "cable"];
const partRarityForLevel = (level: number): PartRarity =>
  level >= 46 ? "legendary" : level >= 36 ? "epic" : level >= 21 ? "rare" : level >= 11 ? "uncommon" : "common";

function alchemyRewardFor(track: SeasonTrack, level: number): SeasonReward {
  const premium = track === "premium";
  const miner = (premium ? alchemyPremiumMinerByLevel : alchemyMinerByLevel)[level];
  if (miner) {
    return { level, track, title: `${miner.title} · C${miner.minerLevel}`, asset: miner.asset, reward: { type: "miner", minerId: miner.id, minerLevel: miner.minerLevel, quantity: 1 } };
  }
  const slot = (level - 1) % 5;
  if (slot === 0) {
    const quantity = premium ? 2 + Math.floor(level / 20) : 1 + Math.floor(level / 25);
    return { level, track, title: `${quantity} baterias`, asset: assetsManifest.battery.path, reward: { type: "battery", quantity } };
  }
  if (slot === 1) {
    const quantity = (premium ? 100 : 50) * Math.ceil(level / 10);
    return { level, track, title: `${quantity} AMC`, asset: assetsManifest.arcadiaCoin.path, reward: { type: "season_currency", quantity } };
  }
  if (slot === 2) {
    const family = partFamilies[(level + (premium ? 1 : 0)) % partFamilies.length];
    const rarity = partRarityForLevel(level);
    const baseQuantity = { common: 100, uncommon: 60, rare: 30, epic: 15, legendary: 8 }[rarity];
    const quantity = premium ? Math.round(baseQuantity * 1.5) : baseQuantity;
    return { level, track, title: `${quantity} ${family === "hashboard" ? "placas" : family === "fan" ? "ventoinhas" : "cabos"}`, asset: partAssetPath(family, rarity), reward: { type: "parts", family, rarity, quantity } };
  }
  const days = level >= 36 ? 7 : level >= 21 ? 3 : 1;
  const powerGh = (premium ? 1_000 : 500) + level * (premium ? 50 : 25);
  if (slot === 3) {
    return { level, track, title: `${powerGh} GH/s por ${days} dia(s)`, asset: assetsManifest.pixelEnergy.path, reward: { type: "power", powerGh, days: days as 1 | 3 | 7 } };
  }
  return { level, track, title: "Rack Arcadia", asset: assetsManifest.rackBasic.path, reward: { type: "rack", quantity: 1 } };
}

export const alchemyRewards: SeasonReward[] = Array.from(
  { length: ALCHEMY_SEASON_LEVELS },
  (_, index) => index + 1,
).flatMap((level) => [
  alchemyRewardFor("free", level),
  alchemyRewardFor("premium", level),
]);

/** Returns the canonical reward lane for the active campaign. */
export function seasonRewardsForCampaign(
  campaignSlug: string,
  allowSeasonalCurrency = true,
) {
  const rewards = campaignSlug === ALCHEMY_SEASON_SLUG
    ? alchemyRewards
    : spaceRaceRewardsForEnvironment(allowSeasonalCurrency);
  return campaignSlug === ALCHEMY_SEASON_SLUG && !allowSeasonalCurrency
    ? rewards.filter((reward) => reward.reward.type !== "season_currency")
    : rewards;
}

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

export function seasonXpRequiredForLevel(level: number, maxLevel = SPACE_RACE_LEVELS) {
  const normalized = Math.max(1, Math.min(maxLevel, Math.floor(level)));
  const completedSteps = normalized - 1;
  return (
    130 * completedSteps +
    (5 * completedSteps * (completedSteps - 1)) / 2
  );
}

export function seasonLevelForXp(xp: number, maxLevel = SPACE_RACE_LEVELS) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (
    level < maxLevel &&
    safeXp >= seasonXpRequiredForLevel(level + 1, maxLevel)
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

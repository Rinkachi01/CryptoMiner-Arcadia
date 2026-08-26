/**
 * Server-authoritative rules for merging miners.
 *
 * A merge is a binary progression tree: two identical miners become one
 * miner one level higher. Reaching level 6 therefore consumes 32 level-1
 * copies (five successful merges). Parts are matched to the source level so
 * the component economy grows with the equipment progression.
 */

import type { PartFamily, PartRarity } from "./parts-rules";

export const MINER_LEVEL_MIN = 1;
export const MINER_LEVEL_MAX = 6;
export const MINER_MERGE_PART_COUNT = 5;

export function getMinerMergePartRequirements(sourceLevel: number): Record<PartFamily, number> {
  const level = normalizeMinerLevel(sourceLevel);
  switch (level) {
    case 1:
      return { hashboard: 150, fan: 150, cable: 100 };
    case 2:
      return { hashboard: 50, fan: 50, cable: 30 };
    case 3:
      return { hashboard: 15, fan: 15, cable: 10 };
    case 4:
      return { hashboard: 3, fan: 3, cable: 2 };
    case 5:
      return { hashboard: 1, fan: 1, cable: 1 };
    default:
      return { hashboard: 0, fan: 0, cable: 0 };
  }
}

export const minerLevelNames: Record<"pt-BR" | "en" | "es", Record<number, string>> = {
  "pt-BR": { 1: "Comum", 2: "Incomum", 3: "Raro", 4: "Épico", 5: "Lendário", 6: "Arcano" },
  en: { 1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic", 5: "Legendary", 6: "Arcane" },
  es: { 1: "Común", 2: "Inusual", 3: "Raro", 4: "Épico", 5: "Legendario", 6: "Arcano" },
};

const partRarityBySourceLevel: Record<number, PartRarity> = {
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "legendary",
};

const mergeFeeBySourceLevel: Record<number, number> = {
  1: 0.1,
  2: 0.35,
  3: 1.2,
  4: 4,
  5: 12,
};

export function normalizeMinerLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(
    MINER_LEVEL_MAX,
    Math.max(MINER_LEVEL_MIN, Math.floor(value)),
  );
}

export function getMinerMergeRequirement(sourceLevel: number) {
  const level = normalizeMinerLevel(sourceLevel);
  if (level >= MINER_LEVEL_MAX) return null;
  return {
    sourceLevel: level,
    targetLevel: level + 1,
    partRarity: partRarityBySourceLevel[level],
    partRequirements: getMinerMergePartRequirements(level),
    feeCma: mergeFeeBySourceLevel[level],
  };
}

/** Power multiplier for one merge at the given source level. */
export function getMinerMergeMultiplier(sourceLevel: number) {
  normalizeMinerLevel(sourceLevel);
  return 2;
}

/** Derive a miner's power from its base definition and stored level. */
export function getMinerPowerAtLevel(basePowerGh: number, level: number) {
  let power = Math.max(0, Number.isFinite(basePowerGh) ? basePowerGh : 0);
  const targetLevel = normalizeMinerLevel(level);
  for (let sourceLevel = 1; sourceLevel < targetLevel; sourceLevel += 1) {
    power *= getMinerMergeMultiplier(sourceLevel);
  }
  return Math.round(power * 100) / 100;
}

export function getMinerLevelPartRarity(level: number): PartRarity | null {
  return partRarityBySourceLevel[normalizeMinerLevel(level)] ?? null;
}

export function getMinerLevelName(level: number, locale: "pt-BR" | "en" | "es" = "pt-BR"): string {
  return minerLevelNames[locale][normalizeMinerLevel(level)] ?? minerLevelNames["pt-BR"][1];
}

/** Compact in-game code shown on a miner's art and rack slot. */
export function getMinerLevelCode(level: number): string {
  return `C${normalizeMinerLevel(level)}`;
}

/**
 * Server-side rules for Arcadia's component system.
 *
 * Parts are progression materials. They do not mint power or wallet balances
 * by themselves; the server consumes them in the priced merge recipes.
 * Keeping the rules here makes the economy auditable and keeps the client
 * from deciding rarity, cost, or merge ratios.
 */

export type PartFamily = "cable" | "hashboard" | "fan";
export type PartRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type PartKey = `${PartFamily}:${PartRarity}`;

export const partFamilies: Array<{
  id: PartFamily;
  label: string;
  assetPrefix: string;
  description: string;
}> = [
  {
    id: "cable",
    label: "Fonte",
    assetPrefix: "cabo",
    description: "Conectores blindados para módulos Arcadia.",
  },
  {
    id: "hashboard",
    label: "Placa",
    assetPrefix: "hashboard",
    description: "Placa de processamento usada na Forja.",
  },
  {
    id: "fan",
    label: "Ventoinha",
    assetPrefix: "ventoinha",
    description: "Refrigeração para manter a operação estável.",
  },
];

export const partRarities: Array<{
  id: PartRarity;
  label: string;
  order: number;
  caseWeight: number;
}> = [
  { id: "common", label: "Comum", order: 0, caseWeight: 6500 },
  { id: "uncommon", label: "Incomum", order: 1, caseWeight: 2500 },
  { id: "rare", label: "Raro", order: 2, caseWeight: 800 },
  { id: "epic", label: "Épico", order: 3, caseWeight: 180 },
  { id: "legendary", label: "Lendário", order: 4, caseWeight: 20 },
];

export const PART_CASE_PRICE_CMA = 1;
// Seasonal cases can contain up to 5,000 common parts. Keep a generous
// server-side cap without allowing unbounded inventory growth.
export const PART_MAX_PER_KEY = 50_000;

export function getPartMergeCount(rarity: PartRarity): number {
  switch (rarity) {
    case "common": return 50;
    case "uncommon": return 25;
    case "rare": return 10;
    case "epic": return 5;
    default: return 5;
  }
}

const mergeFeeBySource: Record<PartRarity, number> = {
  common: 0.02,
  uncommon: 0.05,
  rare: 0.15,
  epic: 0.5,
  legendary: 0,
};

/** Resolve the art filename for every supported rarity. */
export function partAssetRarity(rarity: PartRarity): PartRarity {
  return rarity;
}

export function partAssetPath(
  family: PartFamily,
  rarity: PartRarity,
) {
  const prefix = partFamilies.find((item) => item.id === family)?.assetPrefix ?? family;
  return `/assets/parts/${prefix}_${partAssetRarity(rarity)}.png`;
}

export function partKey(family: PartFamily, rarity: PartRarity): PartKey {
  return `${family}:${rarity}`;
}

export function emptyPartsInventory(): Record<PartKey, number> {
  return Object.fromEntries(
    partFamilies.flatMap((family) =>
      partRarities.map((rarity) => [partKey(family.id, rarity.id), 0]),
    ),
  ) as Record<PartKey, number>;
}

export function normalizePartsInventory(value: unknown) {
  const initial = emptyPartsInventory();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return initial;
  }
  for (const key of Object.keys(initial) as PartKey[]) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      initial[key] = Math.min(PART_MAX_PER_KEY, Math.max(0, Math.floor(raw)));
    }
  }
  return initial;
}

export function isPartFamily(value: unknown): value is PartFamily {
  return partFamilies.some((family) => family.id === value);
}

export function isPartRarity(value: unknown): value is PartRarity {
  return partRarities.some((rarity) => rarity.id === value);
}

export function nextPartRarity(rarity: PartRarity): PartRarity | null {
  const current = partRarities.find((item) => item.id === rarity);
  if (!current) return null;
  return partRarities.find((item) => item.order === current.order + 1)?.id ?? null;
}

export function partMergeFee(rarity: PartRarity) {
  return mergeFeeBySource[rarity];
}

/**
 * Resolve a component case using one server-generated random value. The
 * family and rarity are both selected here, never in the browser.
 */
export function resolvePartCase(roll: number): {
  family: PartFamily;
  rarity: PartRarity;
} {
  const safeRoll = Number.isFinite(roll) ? Math.min(0.999999999, Math.max(0, roll)) : 0;
  const familyIndex = Math.min(
    partFamilies.length - 1,
    Math.floor(safeRoll * partFamilies.length),
  );
  const rarityRoll = (safeRoll * 997) % 1;
  const totalWeight = partRarities.reduce((sum, rarity) => sum + rarity.caseWeight, 0);
  let cursor = rarityRoll * totalWeight;
  const rarity =
    partRarities.find((item) => {
      cursor -= item.caseWeight;
      return cursor < 0;
    })?.id ?? "common";
  return { family: partFamilies[familyIndex].id, rarity };
}

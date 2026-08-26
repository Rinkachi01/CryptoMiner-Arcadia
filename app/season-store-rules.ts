import { partKey, type PartFamily } from "./parts-rules.ts";

/**
 * The pass currency is deliberately separate from CMA. It is a virtual,
 * season-scoped balance: it cannot be withdrawn, converted, or allocated to a
 * mining pool. Change this id when a new pass campaign is activated.
 */
export const SEASON_STORE_SEASON_ID = "season-alchemy-magic-02";
export const SEASON_CURRENCY_SYMBOL = "AMC";
export const SEASON_CURRENCY_MAX = 100_000;

export type SeasonStoreBoxId =
  | "common-hashboard-case"
  | "common-fan-case"
  | "common-wire-case"
  | "mega-parts-case";

export type SeasonStoreFamily = "hashboard" | "fan" | "cable";

export type SeasonStoreBox = {
  id: SeasonStoreBoxId;
  family?: SeasonStoreFamily;
  priceAmc: number;
  title: string;
  description: string;
  contentsLabel: string;
  imagePath: string;
  rewardOptions: readonly SeasonStoreRewardOption[];
};

export type SeasonStoreRewardOption = {
  id: string;
  labelPt: string;
  labelEn: string;
  labelEs: string;
};

export type SeasonStoreOpening = {
  boxId: SeasonStoreBoxId;
  family: SeasonStoreFamily;
  quantity: number;
  rarity: "common";
  key: string;
};

export type SeasonalWallet = {
  seasonId: string;
  amc: number;
};

export function emptySeasonalWallet(
  seasonId = SEASON_STORE_SEASON_ID,
): SeasonalWallet {
  return { seasonId, amc: 0 };
}

const commonQuantities = [1500, 1000, 750, 400, 250] as const;
const megaQuantities = [5000, 4500, 3000, 2500, 2000, 1750, 1500, 1200, 1100, 1000, 800, 700, 600] as const;

const rewardFamilyLabels: Record<SeasonStoreFamily, { pt: string; en: string; es: string }> = {
  hashboard: { pt: "Hashboards Comuns", en: "Common Hashboards", es: "Hashboards Comunes" },
  fan: { pt: "Ventoinhas Comuns", en: "Common Fans", es: "Ventiladores Comunes" },
  cable: { pt: "Cabos Comuns", en: "Common Wires", es: "Cables Comunes" },
};

function buildRewardOptions(
  families: readonly SeasonStoreFamily[],
  quantities: readonly number[],
): readonly SeasonStoreRewardOption[] {
  return families.flatMap((family) =>
    quantities.map((quantity) => ({
      id: `${family}-${quantity}`,
      labelPt: `${quantity.toLocaleString("pt-BR")} ${rewardFamilyLabels[family].pt}`,
      labelEn: `${quantity.toLocaleString("en-US")} ${rewardFamilyLabels[family].en}`,
      labelEs: `${quantity.toLocaleString("es-ES")} ${rewardFamilyLabels[family].es}`,
    })),
  );
}

export const seasonStoreBoxes: readonly SeasonStoreBox[] = [
  {
    id: "common-hashboard-case",
    family: "hashboard",
    priceAmc: 100,
    title: "Common Hashboard Case",
    description: "Uma quantidade variável de Hashboards Comuns.",
    contentsLabel: "1.500 · 1.000 · 750 · 400 · 250 Hashboards",
    imagePath: "/assets/season/arcadia/parts-cases/hashboard_case_hd.png",
    rewardOptions: buildRewardOptions(["hashboard"], commonQuantities),
  },
  {
    id: "common-fan-case",
    family: "fan",
    priceAmc: 100,
    title: "Common Fan Case",
    description: "Uma quantidade variável de Ventoinhas Comuns.",
    contentsLabel: "1.500 · 1.000 · 750 · 400 · 250 Ventoinhas",
    imagePath: "/assets/season/arcadia/parts-cases/fan_case_hd.png",
    rewardOptions: buildRewardOptions(["fan"], commonQuantities),
  },
  {
    id: "common-wire-case",
    family: "cable",
    priceAmc: 100,
    title: "Common Wire Case",
    description: "Uma quantidade variável de Cabos Comuns.",
    contentsLabel: "1.500 · 1.000 · 750 · 400 · 250 Cabos",
    imagePath: "/assets/season/arcadia/parts-cases/cables_case_hd.png",
    rewardOptions: buildRewardOptions(["cable"], commonQuantities),
  },
  {
    id: "mega-parts-case",
    priceAmc: 500,
    title: "Mega Parts Case",
    description: "Uma grande remessa de peças comuns para preparar fusões.",
    contentsLabel: "5.000 até 600 peças · 3 famílias",
    imagePath: "/assets/season/arcadia/parts-cases/mega_parts_case_hd.png",
    rewardOptions: buildRewardOptions(["hashboard", "fan", "cable"], megaQuantities),
  },
];

const familyByBox: Record<SeasonStoreBoxId, SeasonStoreFamily> = {
  "common-hashboard-case": "hashboard",
  "common-fan-case": "fan",
  "common-wire-case": "cable",
  "mega-parts-case": "hashboard",
};

/** Normalize/reset a seasonal wallet without touching permanent inventory. */
export function normalizeSeasonalWallet(
  value: unknown,
  seasonId = SEASON_STORE_SEASON_ID,
): SeasonalWallet {
  if (!value || typeof value !== "object") return { seasonId, amc: 0 };
  const candidate = value as Partial<SeasonalWallet>;
  if (candidate.seasonId !== seasonId) return { seasonId, amc: 0 };
  const amount = typeof candidate.amc === "number" && Number.isFinite(candidate.amc)
    ? Math.round(candidate.amc * 100) / 100
    : 0;
  return { seasonId, amc: Math.max(0, Math.min(SEASON_CURRENCY_MAX, amount)) };
}

function weightedIndex(roll: number, weights: readonly number[]) {
  const safeRoll = Math.max(0, Math.min(0.999999999, Number.isFinite(roll) ? roll : 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = safeRoll * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return index;
  }
  return weights.length - 1;
}

export function getSeasonStoreBox(value: unknown) {
  return seasonStoreBoxes.find((box) => box.id === value);
}

/** Server-only resolution. The browser supplies no outcome or quantity. */
export function resolveSeasonStoreBox(
  boxId: SeasonStoreBoxId,
  roll: number,
): SeasonStoreOpening {
  const box = getSeasonStoreBox(boxId);
  if (!box) throw new Error("Caixa sazonal inválida.");
  const quantity = box.id === "mega-parts-case"
    ? megaQuantities[weightedIndex(roll, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16])]
    : commonQuantities[weightedIndex(roll, [6, 12, 18, 26, 38])];
  const family = box.id === "mega-parts-case"
    ? (["hashboard", "fan", "cable"] as const)[Math.floor(Math.max(0, Math.min(0.999999, roll)) * 3)]
    : familyByBox[box.id];
  const key = partKey(family as PartFamily, "common");
  return { boxId, family, quantity, rarity: "common", key };
}

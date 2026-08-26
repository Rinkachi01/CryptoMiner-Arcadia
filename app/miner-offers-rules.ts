import { miners, getMiner, type MinerDefinition } from "./game-rules.ts";

export type MinerOfferTier = "basic" | "standard" | "premium";

export type MinerOffer = {
  id: string;
  minerId: string;
  tier: MinerOfferTier;
  /** Stable server-time bucket used to rotate the catalogue. */
  rotationKey: string;
  rotationEndsAt: number;
  /** Reference price shown crossed out in the offer card. */
  referencePriceCma: number;
  /** Authoritative sale price charged by the server. */
  priceCma: number;
  discountPercent: number;
  /**
   * Legacy field kept in the catalogue shape for client compatibility.
   * `null` means that a player has no per-account purchase cap; the server
   * still enforces CMA balance and the global inventory limit.
   */
  stockLimit: number | null;
  /** Reference lot size shown for the current rotation; it is not an account cap. */
  lotSize: number;
  badgePt: string;
  badgeEn: string;
  badgeEs: string;
  descriptionPt: string;
  descriptionEn: string;
  descriptionEs: string;
};

export const MINER_OFFER_ROTATION_MS = 48 * 60 * 60 * 1000;

/**
 * Machines from early Season 2 drafts remain in the rules only so that old
 * inventories can still render. They must not leak back into the rotating
 * catalogue after being retired from the live season.
 */
const ACTIVE_SEASON_2_MINER_IDS = new Set([
  "alchemy-crystal-s2",
  "alchemy-cauldron-s2",
  "alchemy-orrery-s2",
  "alchemy-spellbook-s2",
  "alchemy-tower-s2",
]);

export function isMinerOfferEligible(miner: MinerDefinition) {
  // Store machines have a permanent catalogue price. Season 1 machines are
  // explicitly retained for legacy offers; only the final Season 2 catalog is
  // allowed from the seasonal definitions.
  return miner.availability !== "season"
    || miner.id.endsWith("-s1")
    || ACTIVE_SEASON_2_MINER_IDS.has(miner.id);
}

const tierConfig: Record<
  MinerOfferTier,
  { discountPercent: number; lotSize: number }
> = {
  basic: { discountPercent: 12, lotSize: 240 },
  standard: { discountPercent: 18, lotSize: 96 },
  premium: { discountPercent: 24, lotSize: 64 },
};

function rotationIndex(serverNow: number) {
  return Math.max(0, Math.floor(serverNow / MINER_OFFER_ROTATION_MS));
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function roundCma(value: number) {
  return Math.max(0.05, Math.round(value * 100) / 100);
}

/**
 * Permanent miners keep their catalogue price. Seasonal miners do not have
 * one, so their reference price is derived from power and slot footprint.
 * This gives every existing machine a coherent price without introducing
 * free items in the rotating offer market.
 */
function referencePrice(miner: MinerDefinition) {
  // A two-slot machine is intentionally the economical option in the flash
  // market.  Its larger footprint is balanced by a lower unit price, so a
  // player is not punished for choosing the wider rack format.  Apply the
  // same rule to permanent and seasonal machines; otherwise permanent
  // catalogue prices would bypass the offer's slot balancing.
  const slotFactor = miner.slotSize === 2 ? 0.82 : 1;
  if (miner.priceCma > 0) return roundCma(miner.priceCma * slotFactor);
  const rarityFactor = {
    common: 1,
    uncommon: 1.02,
    rare: 1.04,
    epic: 1.06,
    legendary: 1.08,
  }[miner.rarity];
  return roundCma(
    Math.max(0.8, (miner.powerGh / 700) * slotFactor * rarityFactor),
  );
}

function pickMinerForTier(
  candidates: MinerDefinition[],
  tier: MinerOfferTier,
  cycle: number,
) {
  const ranked = [...candidates].sort((left, right) => {
    const leftHash = stableHash(`${cycle}:${tier}:${left.id}`);
    const rightHash = stableHash(`${cycle}:${tier}:${right.id}`);
    return leftHash - rightHash || left.id.localeCompare(right.id);
  });
  return ranked[0];
}

function makeOffer(
  miner: MinerDefinition,
  tier: MinerOfferTier,
  cycle: number,
  rotationEndsAt: number,
): MinerOffer {
  const config = tierConfig[tier];
  const referencePriceCma = referencePrice(miner);
  const priceCma = roundCma(
    referencePriceCma * (1 - config.discountPercent / 100),
  );
  const rotationKey = `r${cycle}`;
  const id = `offer-${tier}-${rotationKey}-${miner.id}`;
  const copy = {
    basic: {
      pt: "OFERTA DE ENTRADA · LOTE ECONÔMICO",
      en: "STARTER OFFER · VALUE LOT",
      es: "OFERTA DE ENTRADA · LOTE ECONÓMICO",
      descPt: "Uma máquina acessível para ampliar o primeiro rack.",
      descEn: "An accessible machine for expanding a first rack.",
      descEs: "Una máquina accesible para ampliar tu primer rack.",
    },
    standard: {
      pt: "ROTAÇÃO DA LOJA · EQUILÍBRIO",
      en: "SHOP ROTATION · BALANCED",
      es: "ROTACIÓN DE TIENDA · EQUILIBRADA",
      descPt: "Poder intermediário com preço reduzido por tempo limitado.",
      descEn: "Mid-range power at a limited-time reduced price.",
      descEs: "Potencia intermedia con precio reducido por tiempo limitado.",
    },
    premium: {
      pt: "DESTAQUE DA ROTAÇÃO · MELHOR PODER",
      en: "ROTATION HIGHLIGHT · TOP POWER",
      es: "DESTACADO DE LA ROTACIÓN · MÁS POTENCIA",
      descPt: "A máquina de maior poder desta rotação de 48 horas.",
      descEn: "The highest-power machine in this 48-hour rotation.",
      descEs: "La máquina de mayor potencia de esta rotación de 48 horas.",
    },
  }[tier];
  return {
    id,
    minerId: miner.id,
    tier,
    rotationKey,
    rotationEndsAt,
    referencePriceCma,
    priceCma,
    discountPercent: config.discountPercent,
    stockLimit: null,
    lotSize: config.lotSize,
    badgePt: copy.pt,
    badgeEn: copy.en,
    badgeEs: copy.es,
    descriptionPt: copy.descPt,
    descriptionEn: copy.descEn,
    descriptionEs: copy.descEs,
  };
}

/**
 * Returns the same three offers for every request in a 48-hour server-time
 * window. The deterministic selection keeps UI and server in sync and avoids
 * changing a machine on every render.
 */
export function getMinerOffers(serverNow: number) {
  const cycle = rotationIndex(serverNow);
  const rotationEndsAt = (cycle + 1) * MINER_OFFER_ROTATION_MS;
  const ranked = miners
    .filter(isMinerOfferEligible)
    .sort((left, right) => left.powerGh - right.powerGh);
  const third = Math.max(1, Math.ceil(ranked.length / 3));
  const tiers: Record<MinerOfferTier, MinerDefinition[]> = {
    basic: ranked.slice(0, third),
    standard: ranked.slice(third, third * 2),
    premium: ranked.slice(third * 2),
  };
  return (Object.keys(tierConfig) as MinerOfferTier[]).map((tier) => {
    const miner = pickMinerForTier(tiers[tier], tier, cycle);
    return makeOffer(miner, tier, cycle, rotationEndsAt);
  });
}

/** Compatibility snapshot for code that only needs a catalogue shape. */
export const minerOffers = getMinerOffers(0);

export function getMinerOffer(value: unknown, serverNow = Date.now()) {
  return typeof value === "string"
    ? getMinerOffers(serverNow).find((offer) => offer.id === value)
    : undefined;
}

export function normalizeMinerOfferPurchases(
  value: unknown,
  serverNow = Date.now(),
) {
  const source = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(
    getMinerOffers(serverNow).map((offer) => [
      offer.id,
      (() => {
        const raw = Number(source[offer.id] ?? 0);
        const count = Number.isFinite(raw) ? Math.floor(raw) : 0;
        return Math.max(
          0,
          offer.stockLimit === null ? count : Math.min(offer.stockLimit, count),
        );
      })(),
    ]),
  ) as Record<string, number>;
}

export function isMinerOfferAvailable(offer: MinerOffer) {
  return Boolean(getMiner(offer.minerId));
}

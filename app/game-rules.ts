import { assetsManifest } from "./assets.manifest.ts";

export const RACK_COLUMNS = 2;
export const RACK_ROWS = 4;
export const RACK_CAPACITY = RACK_COLUMNS * RACK_ROWS;

export type MinerRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type MinerDefinition = {
  id: string;
  name: string;
  asset: string;
  alt: string;
  fanCount: 1 | 2;
  slotSize: 1 | 2;
  powerGh: number;
  energyW: number;
  rarity: MinerRarity;
  priceCma: number;
};

export type InstalledMiner = {
  minerId: string;
  slotIndex: number;
};

export type PoolId = "cma" | "btc" | "doge";

export type MiningPool = {
  id: PoolId;
  name: string;
  symbol: "CMA" | "BTC" | "DOGE";
  asset: string;
  decimals: number;
  blockSeconds: number;
  rewardAtomic: bigint;
  networkPowerGh: number;
  color: string;
  tagline: string;
};

export const miners: MinerDefinition[] = [
  {
    id: "byte-spark",
    name: "Byte Spark",
    asset: assetsManifest.minerOne.path,
    alt: assetsManifest.minerOne.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 120,
    energyW: 65,
    rarity: "common",
    priceCma: 4,
  },
  {
    id: "amber-core",
    name: "Amber Core",
    asset: assetsManifest.minerTwo.path,
    alt: assetsManifest.minerTwo.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 210,
    energyW: 80,
    rarity: "uncommon",
    priceCma: 8.5,
  },
  {
    id: "dual-nova",
    name: "Dual Nova",
    asset: assetsManifest.minerThree.path,
    alt: assetsManifest.minerThree.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 540,
    energyW: 145,
    rarity: "rare",
    priceCma: 18,
  },
  {
    id: "cryo-twin",
    name: "Cryo Twin",
    asset: assetsManifest.minerFour.path,
    alt: assetsManifest.minerFour.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 880,
    energyW: 185,
    rarity: "rare",
    priceCma: 27,
  },
  {
    id: "magenta-flux",
    name: "Magenta Flux",
    asset: assetsManifest.minerFive.path,
    alt: assetsManifest.minerFive.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 1260,
    energyW: 220,
    rarity: "epic",
    priceCma: 42,
  },
  {
    id: "violet-bit",
    name: "Violet Bit",
    asset: assetsManifest.minerSix.path,
    alt: assetsManifest.minerSix.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 360,
    energyW: 105,
    rarity: "uncommon",
    priceCma: 13,
  },
  {
    id: "helix-gold",
    name: "Helix Gold",
    asset: assetsManifest.minerSeven.path,
    alt: assetsManifest.minerSeven.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 1680,
    energyW: 250,
    rarity: "legendary",
    priceCma: 64,
  },
];

export const pools: MiningPool[] = [
  {
    id: "cma",
    name: "Arcadia Pool",
    symbol: "CMA",
    asset: assetsManifest.cmaCoin.path,
    decimals: 6,
    blockSeconds: 300,
    rewardAtomic: 25_000_000n,
    networkPowerGh: 750_000,
    color: "#a9ff3f",
    tagline: "A moeda central da economia de Arcadia",
  },
  {
    id: "btc",
    name: "Bitcoin Pool",
    symbol: "BTC",
    asset: assetsManifest.bitcoin.path,
    decimals: 8,
    blockSeconds: 600,
    rewardAtomic: 85_000n,
    networkPowerGh: 1_800_000,
    color: "#f5a524",
    tagline: "Pool virtual com blocos mais longos",
  },
  {
    id: "doge",
    name: "Dogecoin Pool",
    symbol: "DOGE",
    asset: assetsManifest.dogecoin.path,
    decimals: 8,
    blockSeconds: 240,
    rewardAtomic: 90_000_000_000n,
    networkPowerGh: 900_000,
    color: "#f4d45f",
    tagline: "Blocos rápidos para uma progressão leve",
  },
];

export const defaultInstalledMiners: InstalledMiner[] = [
  { minerId: "byte-spark", slotIndex: 0 },
  { minerId: "dual-nova", slotIndex: 2 },
];

export function getMiner(minerId: string) {
  return miners.find((miner) => miner.id === minerId);
}

export function getOccupiedSlots(
  installed: InstalledMiner[],
  ignoredMinerId?: string,
) {
  const occupied = new Set<number>();

  for (const placement of installed) {
    if (placement.minerId === ignoredMinerId) continue;
    const miner = getMiner(placement.minerId);
    if (!miner) continue;

    for (let offset = 0; offset < miner.slotSize; offset += 1) {
      occupied.add(placement.slotIndex + offset);
    }
  }

  return occupied;
}

export function canInstallAt(
  installed: InstalledMiner[],
  miner: MinerDefinition,
  slotIndex: number,
) {
  if (slotIndex < 0 || slotIndex + miner.slotSize > RACK_CAPACITY) {
    return false;
  }

  const firstRow = Math.floor(slotIndex / RACK_COLUMNS);
  const lastRow = Math.floor(
    (slotIndex + miner.slotSize - 1) / RACK_COLUMNS,
  );

  if (firstRow !== lastRow) {
    return false;
  }

  const occupied = getOccupiedSlots(installed, miner.id);

  for (let offset = 0; offset < miner.slotSize; offset += 1) {
    if (occupied.has(slotIndex + offset)) {
      return false;
    }
  }

  return true;
}

export function findNextAvailableSlot(
  installed: InstalledMiner[],
  miner: MinerDefinition,
) {
  for (let slotIndex = 0; slotIndex < RACK_CAPACITY; slotIndex += 1) {
    if (canInstallAt(installed, miner, slotIndex)) {
      return slotIndex;
    }
  }

  return null;
}

export function getInstalledPower(installed: InstalledMiner[]) {
  return installed.reduce((total, placement) => {
    return total + (getMiner(placement.minerId)?.powerGh ?? 0);
  }, 0);
}

export function getInstalledEnergy(installed: InstalledMiner[]) {
  return installed.reduce((total, placement) => {
    return total + (getMiner(placement.minerId)?.energyW ?? 0);
  }, 0);
}

export function getUsedSlotCount(installed: InstalledMiner[]) {
  return installed.reduce((total, placement) => {
    return total + (getMiner(placement.minerId)?.slotSize ?? 0);
  }, 0);
}

export function calculateEstimatedReward(
  pool: MiningPool,
  playerPowerGh: number,
) {
  if (playerPowerGh <= 0 || pool.networkPowerGh <= 0) return 0n;
  return (
    (pool.rewardAtomic * BigInt(Math.floor(playerPowerGh))) /
    BigInt(pool.networkPowerGh)
  );
}

export function formatAtomic(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

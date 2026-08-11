import { assetsManifest } from "./assets.manifest.ts";

export const RACK_COLUMNS = 2;
export const RACK_ROWS = 4;
export const RACK_CAPACITY = RACK_COLUMNS * RACK_ROWS;
export const ROOM_RACK_CAPACITY = 12;
export const BLOCK_INTERVAL_SECONDS = 600;
export const BLOCKS_PER_DAY = 86_400 / BLOCK_INTERVAL_SECONDS;
export const DEFAULT_BLOCK_REWARD_ATOMIC: Record<PoolId, number> = {
  cma: 5_000,
  btc: 5,
  doge: 1_000_000,
  ltc: 5_000,
};
export const RACK_PRICE_CMA = 0.35;
export const BATTERY_PRICE_CMA = 0.05;
export const BATTERY_HOURS = 12;
export const ENERGY_CLAIM_HOURS = 12;
export const ENERGY_CLAIM_COOLDOWN_HOURS = 12;
export const MAX_ENERGY_HOURS = 96;

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
  rarity: MinerRarity;
  priceCma: number;
  availability?: "store" | "season";
};

export type InstalledMiner = {
  instanceId: string;
  minerId: string;
  slotIndex: number;
};

export type PoolId = "cma" | "btc" | "doge" | "ltc";

export type MiningPool = {
  id: PoolId;
  name: string;
  symbol: "CMA" | "BTC" | "DOGE" | "LTC";
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
    powerGh: 100,
    rarity: "common",
    priceCma: 0.6,
  },
  {
    id: "amber-core",
    name: "Amber Core",
    asset: assetsManifest.minerTwo.path,
    alt: assetsManifest.minerTwo.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 260,
    rarity: "uncommon",
    priceCma: 1.5,
  },
  {
    id: "dual-nova",
    name: "Dual Nova",
    asset: assetsManifest.minerThree.path,
    alt: assetsManifest.minerThree.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 1250,
    rarity: "rare",
    priceCma: 7.2,
  },
  {
    id: "cryo-twin",
    name: "Cryo Twin",
    asset: assetsManifest.minerFour.path,
    alt: assetsManifest.minerFour.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 2800,
    rarity: "rare",
    priceCma: 16,
  },
  {
    id: "violet-bit",
    name: "Violet Bit",
    asset: assetsManifest.minerSix.path,
    alt: assetsManifest.minerSix.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 4500,
    rarity: "epic",
    priceCma: 26,
  },
  {
    id: "magenta-flux",
    name: "Magenta Flux",
    asset: assetsManifest.minerFive.path,
    alt: assetsManifest.minerFive.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 6200,
    rarity: "epic",
    priceCma: 35,
  },
  {
    id: "helix-gold",
    name: "Helix Gold",
    asset: assetsManifest.minerSeven.path,
    alt: assetsManifest.minerSeven.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 14500,
    rarity: "legendary",
    priceCma: 84,
  },
  {
    id: "lunar-rover-s1",
    name: "Lunar Rover",
    asset: assetsManifest.spaceRover.path,
    alt: assetsManifest.spaceRover.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 120,
    rarity: "common",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "relay-satellite-s1",
    name: "Relay Satellite",
    asset: assetsManifest.spaceSatellite.path,
    alt: assetsManifest.spaceSatellite.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 180,
    rarity: "uncommon",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "comet-skiff-s1",
    name: "Comet Skiff",
    asset: assetsManifest.spaceSkiff.path,
    alt: assetsManifest.spaceSkiff.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 260,
    rarity: "uncommon",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "star-scout-s1",
    name: "Star Scout",
    asset: assetsManifest.spaceScout.path,
    alt: assetsManifest.spaceScout.alt,
    fanCount: 1,
    slotSize: 1,
    powerGh: 420,
    rarity: "rare",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "orbit-drill-s1",
    name: "Orbit Drill",
    asset: assetsManifest.spaceDrill.path,
    alt: assetsManifest.spaceDrill.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 600,
    rarity: "rare",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "void-freighter-s1",
    name: "Void Freighter",
    asset: assetsManifest.spaceFreighter.path,
    alt: assetsManifest.spaceFreighter.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 900,
    rarity: "epic",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "plasma-cruiser-s1",
    name: "Plasma Cruiser",
    asset: assetsManifest.spaceCruiser.path,
    alt: assetsManifest.spaceCruiser.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 1_250,
    rarity: "epic",
    priceCma: 0,
    availability: "season",
  },
  {
    id: "arcadia-station-s1",
    name: "Arcadia Station",
    asset: assetsManifest.spaceStation.path,
    alt: assetsManifest.spaceStation.alt,
    fanCount: 2,
    slotSize: 2,
    powerGh: 1_800,
    rarity: "legendary",
    priceCma: 0,
    availability: "season",
  },
];

export const storeMiners = miners.filter(
  (miner) => miner.availability !== "season",
);

export const pools: MiningPool[] = [
  {
    id: "cma",
    name: "Arcadia Pool",
    symbol: "CMA",
    asset: assetsManifest.cmaCoin.path,
    decimals: 6,
    blockSeconds: BLOCK_INTERVAL_SECONDS,
    rewardAtomic: BigInt(DEFAULT_BLOCK_REWARD_ATOMIC.cma),
    networkPowerGh: 60_000_000,
    color: "#a9ff3f",
    tagline: "A moeda central da economia de Arcadia",
  },
  {
    id: "btc",
    name: "Bitcoin Pool",
    symbol: "BTC",
    asset: assetsManifest.bitcoin.path,
    decimals: 8,
    blockSeconds: BLOCK_INTERVAL_SECONDS,
    rewardAtomic: BigInt(DEFAULT_BLOCK_REWARD_ATOMIC.btc),
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
    blockSeconds: BLOCK_INTERVAL_SECONDS,
    rewardAtomic: BigInt(DEFAULT_BLOCK_REWARD_ATOMIC.doge),
    networkPowerGh: 4_000_000,
    color: "#f4d45f",
    tagline: "Blocos rápidos para uma progressão leve",
  },
  {
    id: "ltc",
    name: "Litecoin Pool",
    symbol: "LTC",
    asset: assetsManifest.litecoin.path,
    decimals: 8,
    blockSeconds: BLOCK_INTERVAL_SECONDS,
    rewardAtomic: BigInt(DEFAULT_BLOCK_REWARD_ATOMIC.ltc),
    networkPowerGh: 2_500_000,
    color: "#8da7c8",
    tagline: "Blocos econômicos com liquidação leve",
  },
];

export const defaultInstalledMiners: InstalledMiner[] = [
  {
    instanceId: "starter-byte-spark",
    minerId: "byte-spark",
    slotIndex: 0,
  },
  {
    instanceId: "starter-dual-nova",
    minerId: "dual-nova",
    slotIndex: 2,
  },
];

export function getMiner(minerId: string) {
  return miners.find((miner) => miner.id === minerId);
}

export function getOccupiedSlots(
  installed: InstalledMiner[],
  ignoredInstanceId?: string,
) {
  const occupied = new Set<number>();

  for (const placement of installed) {
    if (placement.instanceId === ignoredInstanceId) continue;
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

  const occupied = getOccupiedSlots(installed);

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

export function getUsedSlotCount(installed: InstalledMiner[]) {
  return installed.reduce((total, placement) => {
    return total + (getMiner(placement.minerId)?.slotSize ?? 0);
  }, 0);
}

export function calculateDailyEstimatedReward(
  pool: MiningPool,
  playerPowerGh: number,
  liveNetworkPowerGh = pool.networkPowerGh,
  blockRewardAtomic = pool.rewardAtomic,
) {
  return calculateEstimatedReward(
    pool,
    playerPowerGh,
    liveNetworkPowerGh,
    blockRewardAtomic,
    BLOCKS_PER_DAY,
  );
}

export function calculateVirtualPaybackDays(miner: MinerDefinition) {
  const cmaPool = pools[0];
  const dailyRewardAtomic =
    (cmaPool.rewardAtomic *
      BigInt(miner.powerGh) *
      BigInt(BLOCKS_PER_DAY)) /
    BigInt(cmaPool.networkPowerGh);

  if (dailyRewardAtomic <= 0n) return Number.POSITIVE_INFINITY;

  const priceAtomic = BigInt(Math.round(miner.priceCma * 1_000_000));
  return Number(priceAtomic) / Number(dailyRewardAtomic);
}

export function calculateEstimatedReward(
  pool: MiningPool,
  playerPowerGh: number,
  liveNetworkPowerGh = pool.networkPowerGh,
  blockRewardAtomic = pool.rewardAtomic,
  blockCount = 1,
) {
  const activeNetworkPowerGh = Math.max(0, Math.floor(liveNetworkPowerGh));
  const safeBlockCount = Math.max(0, Math.floor(blockCount));
  if (
    playerPowerGh <= 0 ||
    activeNetworkPowerGh <= 0 ||
    safeBlockCount <= 0 ||
    blockRewardAtomic <= 0n
  ) {
    return 0n;
  }
  return (
    (blockRewardAtomic *
      BigInt(safeBlockCount) *
      BigInt(Math.floor(playerPowerGh))) /
    BigInt(activeNetworkPowerGh)
  );
}

export function formatAtomic(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

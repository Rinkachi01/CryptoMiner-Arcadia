export type SupplyCrateId = "signal-cache" | "grid-cache" | "quantum-cache";
export type SupplyRewardRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type SupplyCrateReward = {
  id: string;
  label: string;
  type: "battery" | "rack" | "miner";
  quantity: number;
  minerId?: string;
  rarity: SupplyRewardRarity;
  chanceBasisPoints: number;
};

export type SupplyCrate = {
  id: SupplyCrateId;
  name: string;
  shortName: string;
  description: string;
  /** Public sprite used by the shop card and the opening animation. */
  imagePath: string;
  priceCma: number;
  tier: "signal" | "grid" | "quantum";
  rewards: SupplyCrateReward[];
};

export type SupplyCrateOpening = {
  crateId: SupplyCrateId;
  crateName: string;
  reward: SupplyCrateReward;
  pityTriggered: boolean;
  nextPityIn: number;
};

export const SUPPLY_CRATE_PITY_LIMIT = 10;

export const supplyCrates: SupplyCrate[] = [
  {
    id: "signal-cache",
    name: "Caixa Sinal",
    shortName: "SINAL",
    description: "Suprimentos de entrada com chance de minerador Dual Nova.",
    imagePath: "/assets/boxes/supply-signal.png",
    priceCma: 0.9,
    tier: "signal",
    rewards: [
      {
        id: "signal-batteries",
        label: "3 baterias",
        type: "battery",
        quantity: 3,
        rarity: "common",
        chanceBasisPoints: 4_000,
      },
      {
        id: "signal-rack",
        label: "1 rack básico",
        type: "rack",
        quantity: 1,
        rarity: "common",
        chanceBasisPoints: 2_800,
      },
      {
        id: "signal-byte-spark",
        label: "Byte Spark",
        type: "miner",
        minerId: "byte-spark",
        quantity: 1,
        rarity: "uncommon",
        chanceBasisPoints: 2_400,
      },
      {
        id: "signal-amber-core",
        label: "Amber Core",
        type: "miner",
        minerId: "amber-core",
        quantity: 1,
        rarity: "rare",
        chanceBasisPoints: 700,
      },
      {
        id: "signal-dual-nova",
        label: "Dual Nova",
        type: "miner",
        minerId: "dual-nova",
        quantity: 1,
        rarity: "epic",
        chanceBasisPoints: 100,
      },
    ],
  },
  {
    id: "grid-cache",
    name: "Caixa Rede",
    shortName: "REDE",
    description: "Pacote intermediário com equipamentos de até 4.500 GH/s.",
    imagePath: "/assets/boxes/supply-grid.png",
    priceCma: 3.5,
    tier: "grid",
    rewards: [
      {
        id: "grid-batteries",
        label: "5 baterias",
        type: "battery",
        quantity: 5,
        rarity: "common",
        chanceBasisPoints: 3_500,
      },
      {
        id: "grid-racks",
        label: "2 racks básicos",
        type: "rack",
        quantity: 2,
        rarity: "common",
        chanceBasisPoints: 2_500,
      },
      {
        id: "grid-amber-core",
        label: "Amber Core",
        type: "miner",
        minerId: "amber-core",
        quantity: 1,
        rarity: "uncommon",
        chanceBasisPoints: 2_300,
      },
      {
        id: "grid-dual-nova",
        label: "Dual Nova",
        type: "miner",
        minerId: "dual-nova",
        quantity: 1,
        rarity: "rare",
        chanceBasisPoints: 1_300,
      },
      {
        id: "grid-cryo-twin",
        label: "Cryo Twin",
        type: "miner",
        minerId: "cryo-twin",
        quantity: 1,
        rarity: "epic",
        chanceBasisPoints: 350,
      },
      {
        id: "grid-violet-bit",
        label: "Violet Bit",
        type: "miner",
        minerId: "violet-bit",
        quantity: 1,
        rarity: "legendary",
        chanceBasisPoints: 50,
      },
    ],
  },
  {
    id: "quantum-cache",
    name: "Caixa Quantum",
    shortName: "QUANTUM",
    description: "Suprimentos avançados com chance do lendário Helix Gold.",
    imagePath: "/assets/boxes/supply-quantum.png",
    priceCma: 12,
    tier: "quantum",
    rewards: [
      {
        id: "quantum-batteries",
        label: "8 baterias",
        type: "battery",
        quantity: 8,
        rarity: "common",
        chanceBasisPoints: 3_000,
      },
      {
        id: "quantum-racks",
        label: "4 racks básicos",
        type: "rack",
        quantity: 4,
        rarity: "common",
        chanceBasisPoints: 2_500,
      },
      {
        id: "quantum-dual-nova",
        label: "Dual Nova",
        type: "miner",
        minerId: "dual-nova",
        quantity: 1,
        rarity: "uncommon",
        chanceBasisPoints: 2_300,
      },
      {
        id: "quantum-cryo-twin",
        label: "Cryo Twin",
        type: "miner",
        minerId: "cryo-twin",
        quantity: 1,
        rarity: "rare",
        chanceBasisPoints: 1_400,
      },
      {
        id: "quantum-violet-bit",
        label: "Violet Bit",
        type: "miner",
        minerId: "violet-bit",
        quantity: 1,
        rarity: "epic",
        chanceBasisPoints: 600,
      },
      {
        id: "quantum-magenta-flux",
        label: "Magenta Flux",
        type: "miner",
        minerId: "magenta-flux",
        quantity: 1,
        rarity: "epic",
        chanceBasisPoints: 180,
      },
      {
        id: "quantum-helix-gold",
        label: "Helix Gold",
        type: "miner",
        minerId: "helix-gold",
        quantity: 1,
        rarity: "legendary",
        chanceBasisPoints: 20,
      },
    ],
  },
];

const protectedRarities = new Set<SupplyRewardRarity>([
  "rare",
  "epic",
  "legendary",
]);

export function getSupplyCrate(id: unknown) {
  return supplyCrates.find((crate) => crate.id === id);
}

function rewardFromBasisPoints(
  rewards: SupplyCrateReward[],
  roll: number,
) {
  const total = rewards.reduce(
    (sum, reward) => sum + reward.chanceBasisPoints,
    0,
  );
  let cursor = Math.min(0.999999999, Math.max(0, roll)) * total;
  for (const reward of rewards) {
    cursor -= reward.chanceBasisPoints;
    if (cursor < 0) return reward;
  }
  return rewards.at(-1) as SupplyCrateReward;
}

export function resolveSupplyCrate(
  crateId: SupplyCrateId,
  roll: number,
  pityStreak: number,
): SupplyCrateOpening {
  const crate = getSupplyCrate(crateId);
  if (!crate) throw new Error("Caixa de suprimentos inválida.");
  const pityTriggered = pityStreak >= SUPPLY_CRATE_PITY_LIMIT - 1;
  const rewardPool = pityTriggered
    ? crate.rewards.filter((reward) => protectedRarities.has(reward.rarity))
    : crate.rewards;
  const reward = rewardFromBasisPoints(rewardPool, roll);
  const rareOrBetter = protectedRarities.has(reward.rarity);
  const nextStreak = rareOrBetter ? 0 : Math.min(9, pityStreak + 1);

  return {
    crateId,
    crateName: crate.name,
    reward,
    pityTriggered,
    nextPityIn: SUPPLY_CRATE_PITY_LIMIT - nextStreak,
  };
}

export function formatCrateChance(chanceBasisPoints: number) {
  return `${(chanceBasisPoints / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: chanceBasisPoints < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}%`;
}

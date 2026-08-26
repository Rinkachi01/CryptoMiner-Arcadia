/**
 * Lucky crates use the permanent CMA balance. AMC is intentionally reserved
 * for the seasonal store and seasonal parts cases, so opening a Lucky crate
 * never creates a withdrawable or season-bound balance by accident.
 */
export type LuckCrateId = "luck-bronze" | "luck-silver" | "luck-gold";

export type LuckCrateReward = {
  id: string;
  label: string;
  amountCma: number;
  chanceBasisPoints: number;
};

export type LuckCrate = {
  id: LuckCrateId;
  name: string;
  shortName: string;
  description: string;
  priceCma: number;
  imagePath: string;
  rewards: LuckCrateReward[];
};

export type LuckCrateOpening = {
  crateId: LuckCrateId;
  crateName: string;
  reward: LuckCrateReward;
  priceCma: number;
};

// The reward ladders are intentionally explicit: the 750 and 1500 cases do
// not simply multiply the smaller case, which keeps their economy readable.
const bronzeAmounts = [
  250, 50, 25, 9, 7, 5, 4, 3, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.15,
] as const;
const silverAmounts = [
  750, 150, 75, 20, 15, 10, 8, 7, 5, 4, 2, 1.5, 1, 0.5, 0.25,
] as const;
const goldAmounts = [
  1500, 250, 150, 50, 40, 30, 19, 17, 15, 12, 7, 4, 3, 2, 1,
] as const;
const bronzeWeights = [
  1, 4, 8, 35, 55, 100, 170, 300, 500, 750, 1000, 1300, 1700, 1900, 2177,
] as const;

function rewardsFor(amounts: readonly number[], tier: string): LuckCrateReward[] {
  return amounts.map((amount, index) => ({
    id: `cma-${tier}-${String(amount).replace(".", "-")}`,
    label: `${amount} CMA`,
    amountCma: amount,
    chanceBasisPoints: bronzeWeights[index],
  }));
}

export const luckCrates: readonly LuckCrate[] = [
  {
    id: "luck-bronze",
    name: "Caixa da Sorte · Bronze",
    shortName: "BRONZE",
    description: "Prêmios CMA compactos para abrir com seu saldo principal.",
    priceCma: 1.99,
    imagePath: "/assets/boxes/luck-bronze.png",
    rewards: rewardsFor(bronzeAmounts, "bronze"),
  },
  {
    id: "luck-silver",
    name: "Caixa da Sorte · Prata",
    shortName: "PRATA",
    description: "Uma caixa intermediária com até 750 CMA.",
    priceCma: 3.99,
    imagePath: "/assets/boxes/luck-silver.png",
    rewards: rewardsFor(silverAmounts, "silver"),
  },
  {
    id: "luck-gold",
    name: "Caixa da Sorte · Ouro",
    shortName: "OURO",
    description: "A caixa premium com até 1.500 CMA.",
    priceCma: 11.99,
    imagePath: "/assets/boxes/luck-gold.png",
    rewards: rewardsFor(goldAmounts, "gold"),
  },
];

export function getLuckCrate(value: unknown) {
  return luckCrates.find((crate) => crate.id === value);
}

function rewardFromBasisPoints(rewards: readonly LuckCrateReward[], roll: number) {
  const total = rewards.reduce((sum, reward) => sum + reward.chanceBasisPoints, 0);
  let cursor = Math.min(0.999999999, Math.max(0, Number.isFinite(roll) ? roll : 0)) * total;
  for (const reward of rewards) {
    cursor -= reward.chanceBasisPoints;
    if (cursor < 0) return reward;
  }
  return rewards[rewards.length - 1];
}

export function resolveLuckCrate(crateId: LuckCrateId, roll: number): LuckCrateOpening {
  const crate = getLuckCrate(crateId);
  if (!crate) throw new Error("Caixa da sorte inválida.");
  return {
    crateId: crate.id,
    crateName: crate.name,
    reward: rewardFromBasisPoints(crate.rewards, roll),
    priceCma: crate.priceCma,
  };
}

export function formatLuckChance(chanceBasisPoints: number) {
  return `${(chanceBasisPoints / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: chanceBasisPoints < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}%`;
}

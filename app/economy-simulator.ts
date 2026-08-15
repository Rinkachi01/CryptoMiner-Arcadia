import { storeMiners } from "./game-rules.ts";
import { supplyCrates } from "./supply-crate-rules.ts";

export const BASE_DAILY_GAME_POWER_BUDGET_GH = 10_000;

export const DEFAULT_SIMULATION_INPUT = {
  cratePricePercent: 100,
  minerPricePercent: 100,
  minigamePowerPercent: 100,
  networkDifficultyPercent: 100,
};

export type EconomySimulationInput = typeof DEFAULT_SIMULATION_INPUT;

function clampPercent(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function simulateEconomy(input: EconomySimulationInput) {
  const normalized = {
    cratePricePercent: clampPercent(input.cratePricePercent, 50, 200),
    minerPricePercent: clampPercent(input.minerPricePercent, 50, 200),
    minigamePowerPercent: clampPercent(input.minigamePowerPercent, 0, 150),
    networkDifficultyPercent: clampPercent(
      input.networkDifficultyPercent,
      60,
      240,
    ),
  };
  const priceFactor = normalized.minerPricePercent / 100;
  const crateFactor = normalized.cratePricePercent / 100;
  const networkFactor = normalized.networkDifficultyPercent / 100;
  const minigameFactor = normalized.minigamePowerPercent / 100;
  const temporaryPowerRelief = 0.9 + minigameFactor * 0.1;
  const progressionDays = Math.round(
    (303 * priceFactor * networkFactor) / temporaryPowerRelief,
  );
  const sinkIndex = Math.round(
    normalized.minerPricePercent * 0.72 +
      normalized.cratePricePercent * 0.28,
  );
  const status =
    progressionDays < 210
      ? "critical"
      : progressionDays < 260
        ? "attention"
        : progressionDays > 460
          ? "slow"
          : "stable";

  return {
    adjustedCrates: supplyCrates.map((crate) => ({
      id: crate.id,
      name: crate.name,
      priceCma:
        Math.round(crate.priceCma * crateFactor * 100) / 100,
    })),
    adjustedMiners: storeMiners.map((miner) => ({
      id: miner.id,
      name: miner.name,
      priceCma:
        Math.round(miner.priceCma * priceFactor * 100) / 100,
    })),
    dailyPowerBudgetGh: Math.round(
      BASE_DAILY_GAME_POWER_BUDGET_GH * minigameFactor,
    ),
    normalized,
    progressionDays,
    sinkIndex,
    status,
  };
}

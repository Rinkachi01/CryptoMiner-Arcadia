import {
  MAX_GAME_DIFFICULTY,
  gameCooldownSeconds,
  seededRandom,
} from "./packet-catch-rules.ts";

export const CIRCUIT_RUSH_HOURLY_LIMIT = 6;
export const CIRCUIT_RUSH_DAILY_LIMIT = 18;
export const CIRCUIT_RUSH_POWER_DURATION_HOURS = 6;

export type CircuitStep = {
  id: string;
  targetCell: number;
  decoyCells: number[];
};

export type CircuitEvent = {
  stepId: string;
  cell: number;
  atMs: number;
};

export function circuitRushStepCount(difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  return Math.min(13, 7 + Math.floor((level - 1) * 0.7));
}

export function circuitRushDurationMs(difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  return Math.max(18_000, 29_000 - (level - 1) * 1_200);
}

export function createCircuitSteps(seed: string, difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  const random = seededRandom(`circuit-rush:${seed}:${level}`);
  const decoyCount = Math.min(6, 2 + Math.floor((level - 1) / 2));
  const steps: CircuitStep[] = [];
  let previousTarget = -1;

  for (let index = 0; index < circuitRushStepCount(level); index += 1) {
    let targetCell = Math.floor(random() * 16);
    while (targetCell === previousTarget) {
      targetCell = Math.floor(random() * 16);
    }
    previousTarget = targetCell;

    const decoyCells = new Set<number>();
    while (decoyCells.size < decoyCount) {
      const cell = Math.floor(random() * 16);
      if (cell !== targetCell) decoyCells.add(cell);
    }
    steps.push({
      id: `circuit-${index + 1}`,
      targetCell,
      decoyCells: [...decoyCells],
    });
  }

  return steps;
}

export function validateCircuitRush(
  seed: string,
  difficulty: number,
  events: CircuitEvent[],
) {
  const steps = createCircuitSteps(seed, difficulty);
  let lastEventAt = -1_000;

  for (const [index, event] of events.entries()) {
    const step = steps[index];
    if (
      !event ||
      typeof event !== "object" ||
      !step ||
      event.stepId !== step.id ||
      !Number.isInteger(event.cell) ||
      event.cell < 0 ||
      event.cell >= 16 ||
      !Number.isInteger(event.atMs) ||
      event.atMs < 0 ||
      event.atMs < lastEventAt ||
      event.atMs - lastEventAt < 90
    ) {
      return { valid: false as const, reason: "Sequência de circuito inválida." };
    }
    lastEventAt = event.atMs;
    if (event.cell !== step.targetCell) {
      return {
        valid: true as const,
        completed: false,
        failed: true,
        hits: index,
        lastEventAt,
      };
    }
  }

  return {
    valid: true as const,
    completed: events.length === steps.length,
    failed: false,
    hits: events.length,
    lastEventAt,
  };
}

export function circuitRushRewardPower(
  difficulty: number,
  hits: number,
  durationMs: number,
) {
  if (hits < circuitRushStepCount(difficulty)) return 0;
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  const speedBonus = Math.max(
    0,
    Math.round((circuitRushDurationMs(level) - durationMs) / 450),
  );
  return Math.min(300, 55 + hits * 10 + level * 11 + speedBonus);
}

export { gameCooldownSeconds };

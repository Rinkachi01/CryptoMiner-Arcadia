import assert from "node:assert/strict";
import test from "node:test";
import {
  circuitRushDurationMs,
  circuitRushRewardPower,
  circuitRushStepCount,
  createCircuitSteps,
  validateCircuitRush,
} from "../app/circuit-rush-rules.ts";

test("Circuit Rush cria uma sequência determinística e válida", () => {
  const first = createCircuitSteps("circuit-seed", 5);
  const second = createCircuitSteps("circuit-seed", 5);
  assert.deepEqual(first, second);
  assert.equal(first.length, circuitRushStepCount(5));
  assert.equal(
    first.every(
      (step) =>
        !step.decoyCells.includes(step.targetCell) &&
        new Set(step.decoyCells).size === step.decoyCells.length,
    ),
    true,
  );
});

test("Circuit Rush aceita a rota correta e detecta bloqueio", () => {
  const steps = createCircuitSteps("route-seed", 3);
  const correct = validateCircuitRush(
    "route-seed",
    3,
    steps.map((step, index) => ({
      stepId: step.id,
      cell: step.targetCell,
      atMs: 300 + index * 250,
    })),
  );
  assert.equal(correct.valid && correct.completed, true);

  const failed = validateCircuitRush("route-seed", 3, [
    {
      stepId: steps[0].id,
      cell: steps[0].decoyCells[0],
      atMs: 300,
    },
  ]);
  assert.equal(failed.valid && failed.failed, true);
});

test("dificuldade reduz o tempo e aumenta a rota", () => {
  assert.equal(circuitRushStepCount(1) < circuitRushStepCount(10), true);
  assert.equal(circuitRushDurationMs(1) > circuitRushDurationMs(10), true);
});

test("recompensa só existe com todos os pulsos e possui teto", () => {
  assert.equal(circuitRushRewardPower(4, 2, 10_000), 0);
  assert.equal(
    circuitRushRewardPower(10, circuitRushStepCount(10), 1_000) <= 140,
    true,
  );
});

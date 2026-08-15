import assert from "node:assert/strict";
import test from "node:test";
import {
  BONUS_POWER_DROP_CHANCE,
  BONUS_POWER_DROP_REQUEST_GH,
  shouldAwardBonusPower,
} from "../app/game-power-bonus.ts";

test("bônus opcional de poder tem proporção conservadora", () => {
  assert.equal(BONUS_POWER_DROP_CHANCE, 0.12);
  assert.equal(BONUS_POWER_DROP_REQUEST_GH, 150);
  assert.equal(shouldAwardBonusPower(() => 0.119), true);
  assert.equal(shouldAwardBonusPower(() => 0.12), false);
  assert.equal(shouldAwardBonusPower(() => 0.9), false);
});

test("sorteio inválido nunca concede bônus", () => {
  assert.equal(shouldAwardBonusPower(() => Number.NaN), false);
  assert.equal(shouldAwardBonusPower(() => -0.1), false);
  assert.equal(shouldAwardBonusPower(() => 1.1), false);
});

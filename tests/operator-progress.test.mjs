import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOperatorLeague,
  calculateOperatorProgress,
  operatorXp,
  xpRequiredForLevel,
} from "../app/operator-progress-rules.ts";

test("XP do operador recompensa mais vitórias do que tentativas", () => {
  assert.equal(operatorXp(1, 1), 138);
  assert.equal(operatorXp(10, 0) < operatorXp(2, 2), true);
});

test("liga do operador avança por marcos sem ultrapassar cem por cento", () => {
  const bronze = calculateOperatorLeague(5, xpRequiredForLevel(5));
  const diamond = calculateOperatorLeague(50, xpRequiredForLevel(50));
  assert.equal(bronze.name, "Bronze II");
  assert.equal(bronze.nextName, "Bronze I");
  assert.equal(bronze.progressPercent >= 0, true);
  assert.equal(bronze.progressPercent <= 100, true);
  assert.equal(diamond.name, "Diamante");
  assert.equal(diamond.nextName, null);
  assert.equal(diamond.progressPercent, 100);
});

test("níveis exigem progressivamente mais experiência", () => {
  assert.equal(xpRequiredForLevel(2) > xpRequiredForLevel(1), true);
  assert.equal(
    xpRequiredForLevel(10) - xpRequiredForLevel(9) >
      xpRequiredForLevel(3) - xpRequiredForLevel(2),
    true,
  );
});

test("progresso do operador permanece entre zero e cem por cento", () => {
  const progress = calculateOperatorProgress(18, 7);
  assert.equal(progress.level >= 2, true);
  assert.equal(progress.progressPercent >= 0, true);
  assert.equal(progress.progressPercent <= 100, true);
  assert.equal(progress.nextLevelXp > progress.currentLevelXp, true);
});

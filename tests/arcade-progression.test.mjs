import assert from "node:assert/strict";
import test from "node:test";
import {
  arcadeDifficultyAfterInactivity,
  arcadePowerDurationDays,
  arcadePowerExpiresAt,
  nextArcadeDifficulty,
} from "../app/arcade-progression-rules.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

test("níveis do arcade vão de 1 a 5 e liberam até sete dias", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(arcadePowerDurationDays),
    [1, 2, 3, 5, 7],
  );
  assert.equal(nextArcadeDifficulty(5), 5);
  assert.equal(arcadePowerExpiresAt(1_000, 4), 1_000 + 5 * DAY_MS);
});

test("inatividade reduz um nível por dia completo", () => {
  const now = 20 * DAY_MS;
  assert.equal(arcadeDifficultyAfterInactivity(5, now - DAY_MS, now), 4);
  assert.equal(arcadeDifficultyAfterInactivity(5, now - 3 * DAY_MS, now), 2);
  assert.equal(arcadeDifficultyAfterInactivity(3, now - 10 * DAY_MS, now), 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  pcLevelAfterInactivity,
  pcLevelForPlays,
  pcNextPlayTarget,
  pcProgressPercent,
} from "../app/pc-progression-rules.ts";

test("PC sobe por partidas jogadas, não por vitória isolada", () => {
  assert.equal(pcLevelForPlays(0), 0);
  assert.equal(pcLevelForPlays(9), 0);
  assert.equal(pcLevelForPlays(10), 1);
  assert.equal(pcLevelForPlays(29), 1);
  assert.equal(pcLevelForPlays(30), 2);
  assert.equal(pcLevelForPlays(60), 3);
  assert.equal(pcLevelForPlays(150), 5);
});

test("barra do PC mostra o próximo marco de partidas", () => {
  assert.equal(pcNextPlayTarget(1), 10);
  assert.equal(pcNextPlayTarget(4), 100);
  assert.equal(pcProgressPercent(5, 0), 50);
  assert.equal(pcProgressPercent(29, 1), 95);
  assert.equal(pcProgressPercent(150, 5), 100);
});

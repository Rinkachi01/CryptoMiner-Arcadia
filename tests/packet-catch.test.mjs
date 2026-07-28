import assert from "node:assert/strict";
import test from "node:test";
import {
  createPacketTargets,
  packetCatchRewardPower,
  scorePacketCatch,
} from "../app/packet-catch-rules.ts";

test("agenda do Packet Catch é reproduzível no cliente e no servidor", () => {
  const first = createPacketTargets("arcadia-seed");
  const second = createPacketTargets("arcadia-seed");
  assert.deepEqual(first, second);
  assert.equal(first.length, 18);
  assert.equal(first.every((target) => target.lane >= 0 && target.lane < 5), true);
});

test("servidor recalcula a pontuação usando a agenda original", () => {
  const targets = createPacketTargets("score-seed");
  const validTargets = targets.filter((target) => target.kind === "valid").slice(0, 4);
  const result = scorePacketCatch(
    "score-seed",
    validTargets.map((target, index) => ({
      targetId: target.id,
      atMs: target.appearsAtMs + 300 + index * 90,
    })),
  );
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.score > 0, true);
});

test("clique impossível ou duplicado é recusado", () => {
  const target = createPacketTargets("fraud-seed")[0];
  const result = scorePacketCatch("fraud-seed", [
    { targetId: target.id, atMs: target.appearsAtMs + 100 },
    { targetId: target.id, atMs: target.appearsAtMs + 300 },
  ]);
  assert.equal(result.valid, false);
});

test("faixas de recompensa têm teto conservador", () => {
  assert.equal(packetCatchRewardPower(39), 0);
  assert.equal(packetCatchRewardPower(40), 90);
  assert.equal(packetCatchRewardPower(80), 160);
  assert.equal(packetCatchRewardPower(125), 240);
  assert.equal(packetCatchRewardPower(999), 240);
});

import assert from "node:assert/strict";
import test from "node:test";
import { gameCoins } from "../app/game-coin-catalog.ts";
import {
  createPacketTargets,
  gameCooldownSeconds,
  missedPacketCoins,
  packetCatchRewardPower,
  scorePacketCatch,
  thirdPacketMissAt,
} from "../app/packet-catch-rules.ts";

test("agenda de moedas é reproduzível por nível", () => {
  const first = createPacketTargets("arcadia-seed", 4);
  const second = createPacketTargets("arcadia-seed", 4);
  assert.deepEqual(first, second);
  assert.equal(first.length > 18, true);
  assert.equal(first.every((target) => target.lane >= 0 && target.lane < 5), true);
});

test("todas as moedas possuem imagem e pontuação própria", () => {
  assert.equal(gameCoins.length, 12);
  assert.equal(new Set(gameCoins.map((coin) => coin.points)).size, 12);
  assert.equal(gameCoins.every((coin) => coin.asset.startsWith("/assets/")), true);
});

test("servidor recalcula pontos usando as moedas originais", () => {
  const targets = createPacketTargets("score-seed", 2);
  const coins = targets.filter((target) => target.kind === "coin").slice(0, 4);
  const result = scorePacketCatch(
    "score-seed",
    2,
    coins.map((target) => ({
      targetId: target.id,
      atMs: target.appearsAtMs + 250,
    })),
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.score, coins.reduce((sum, coin) => sum + coin.points, 0));
    assert.equal(result.bombHit, false);
  }
});

test("bomba zera a partida e precisa ser o último clique", () => {
  let seedIndex = 0;
  let bomb;
  let seed = "";
  while (!bomb) {
    seed = `bomb-seed-${seedIndex}`;
    bomb = createPacketTargets(seed, 5).find((target) => target.kind === "bomb");
    seedIndex += 1;
  }
  const result = scorePacketCatch(seed, 5, [
    { targetId: bomb.id, atMs: bomb.appearsAtMs + 220 },
  ]);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.bombHit, true);
    assert.equal(result.score, 0);
  }
});

test("recompensa é nula ao tocar bomba e possui teto", () => {
  assert.equal(packetCatchRewardPower(500, 10, true), 0);
  assert.equal(packetCatchRewardPower(19, 1, false), 0);
  assert.equal(packetCatchRewardPower(999, 10, false), 320);
});

test("recarga cresce com atividade e dificuldade", () => {
  assert.equal(gameCooldownSeconds(0, 1) < gameCooldownSeconds(12, 1), true);
  assert.equal(gameCooldownSeconds(3, 2) < gameCooldownSeconds(3, 8), true);
});

test("três moedas no chão esgotam as vidas no instante validado", () => {
  const seed = "three-lives-seed";
  const thirdMissAt = thirdPacketMissAt(seed, 1, []);
  assert.equal(typeof thirdMissAt, "number");
  const missed = missedPacketCoins(seed, 1, [], thirdMissAt);
  assert.equal(missed.length, 3);
});

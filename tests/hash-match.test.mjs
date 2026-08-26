import assert from "node:assert/strict";
import test from "node:test";
import {
  createHashMatchProof,
  hashMatchDurationMs,
  hashMatchPairCount,
  hashMatchRewardPower,
  revealHashCard,
} from "../app/hash-match-rules.ts";

test("Hash Match cria pares determinísticos sem revelar o tabuleiro público", () => {
  const proof = createHashMatchProof("memory-seed", 3);
  const again = createHashMatchProof("memory-seed", 3);
  assert.deepEqual(proof, again);
  assert.equal(proof.deck.length, hashMatchPairCount(3) * 2);
  for (const card of proof.deck) {
    assert.equal(
      proof.deck.filter((candidate) => candidate.coinId === card.coinId).length,
      2,
    );
  }
});

test("carta só é revelada a partir do estado guardado no servidor", () => {
  const proof = createHashMatchProof("reveal-seed", 1);
  const reveal = revealHashCard(proof, proof.deck[0].id);
  assert.ok(reveal);
  assert.equal(reveal.cardId, proof.deck[0].id);
  assert.equal(typeof reveal.asset, "string");
});

test("dificuldade adiciona pares e reduz o tempo", () => {
  assert.equal(hashMatchPairCount(1) < hashMatchPairCount(10), true);
  assert.equal(hashMatchDurationMs(1) > hashMatchDurationMs(10), true);
  assert.equal(hashMatchDurationMs(1) >= 100_000, true);
  assert.equal(hashMatchDurationMs(10) >= 75_000, true);
});

test("recompensa da memória penaliza excesso de jogadas e possui teto", () => {
  const ideal = hashMatchRewardPower(5, 6, 6);
  const wasteful = hashMatchRewardPower(5, 6, 20);
  assert.equal(ideal > wasteful, true);
  assert.equal(hashMatchRewardPower(10, 8, 8) <= 200, true);
});

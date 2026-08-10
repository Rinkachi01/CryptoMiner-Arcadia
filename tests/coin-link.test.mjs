import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCoinLinkMove,
  COIN_LINK_BOARD_SIZE,
  coinLinkRewardPower,
  coinLinkTargetScore,
  createCoinLinkBoard,
  findCoinLinkMatches,
  validateCoinLink,
} from "../app/coin-link-rules.ts";

function firstPlayableMove(board, seed, difficulty) {
  for (let from = 0; from < board.length; from += 1) {
    for (const to of [from + 1, from + COIN_LINK_BOARD_SIZE]) {
      const result = applyCoinLinkMove(
        board,
        seed,
        difficulty,
        0,
        from,
        to,
      );
      if (result.valid) return { from, to, result };
    }
  }
  return null;
}

test("Coin Cascade cria tabuleiro determinístico, limpo e jogável", () => {
  const first = createCoinLinkBoard("cascade-seed", 4);
  const second = createCoinLinkBoard("cascade-seed", 4);
  assert.deepEqual(first, second);
  assert.equal(first.length, COIN_LINK_BOARD_SIZE ** 2);
  assert.deepEqual(findCoinLinkMatches(first), []);
  assert.ok(firstPlayableMove(first, "cascade-seed", 4));
});

test("troca válida gera a mesma cascata no cliente e no replay", () => {
  const seed = "replay-seed";
  const difficulty = 3;
  const board = createCoinLinkBoard(seed, difficulty);
  const move = firstPlayableMove(board, seed, difficulty);
  assert.ok(move);

  const replay = validateCoinLink(seed, difficulty, [
    { from: move.from, to: move.to, atMs: 800 },
  ]);
  assert.equal(replay.valid, true);
  assert.equal(replay.valid && replay.score, move.result.score);
  assert.deepEqual(replay.valid && replay.board, move.result.board);
});

test("servidor rejeita troca distante e combinação inexistente", () => {
  const board = createCoinLinkBoard("invalid-seed", 1);
  const distant = applyCoinLinkMove(board, "invalid-seed", 1, 0, 0, 35);
  assert.equal(distant.valid, false);

  const invalidReplay = validateCoinLink("invalid-seed", 1, [
    { from: 0, to: 35, atMs: 500 },
  ]);
  assert.equal(invalidReplay.valid, false);
});

test("recompensa exige a meta e respeita o teto econômico", () => {
  const target = coinLinkTargetScore(10);
  assert.equal(coinLinkRewardPower(10, target - 1), 0);
  assert.equal(coinLinkRewardPower(10, target + 100_000), 300);
});

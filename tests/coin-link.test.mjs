import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCoinLinkMove,
  COIN_LINK_BOARD_SIZE,
  coinLinkRewardPower,
  coinLinkTargetScore,
  coinLinkBoardHasMove,
  createCoinLinkBoard,
  coinLinkCoinPool,
  findCoinLinkMatchGroups,
  findCoinLinkMatches,
  reshuffleCoinLinkBoard,
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
  assert.equal(move.result.steps.length, move.result.cascades);
});

test("linhas de 4 e 5 moedas são reconhecidas e recebem bônus", () => {
  const board = [
    "usdt", "doge", "usdt", "usdt", "xrp", "matic",
    "doge", "usdt", "trx", "xrp", "matic", "doge",
    "trx", "xrp", "matic", "doge", "usdt", "trx",
    "xrp", "matic", "doge", "trx", "xrp", "matic",
    "matic", "trx", "xrp", "matic", "doge", "usdt",
    "doge", "xrp", "trx", "usdt", "matic", "doge",
  ];
  const result = applyCoinLinkMove(board, "long-line", 1, 0, 1, 7);
  assert.equal(result.valid, true);
  assert.equal(result.steps[0].maxRun, 4);
  assert.ok(result.steps[0].sizeBonus > 0);

  const fiveLine = [...board];
  fiveLine.splice(0, 6, "btc", "btc", "btc", "btc", "btc", "doge");
  const groups = findCoinLinkMatchGroups(fiveLine);
  assert.ok(groups.some((group) => group.length === 5));
});

test("dificuldade aumenta a variedade sem retirar o fator sorte", () => {
  assert.equal(coinLinkCoinPool(1).length, 5);
  assert.equal(coinLinkCoinPool(5).length, 6);
  assert.equal(coinLinkCoinPool(9).length, 6);
  assert.deepEqual(coinLinkCoinPool(9), coinLinkCoinPool(9));
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

test("tabuleiro sem jogadas é reorganizado sem perder moedas", () => {
  // A Latin-square layout with six coin types has no existing run and no
  // adjacent swap that can create a run, so it is a genuine dead board.
  const deadBoard = [
    "doge", "matic", "usdt", "xrp", "ltc", "btc",
    "matic", "usdt", "xrp", "ltc", "btc", "doge",
    "usdt", "xrp", "ltc", "btc", "doge", "matic",
    "xrp", "ltc", "btc", "doge", "matic", "usdt",
    "ltc", "btc", "doge", "matic", "usdt", "xrp",
    "btc", "doge", "matic", "usdt", "xrp", "ltc",
  ];
  assert.equal(coinLinkBoardHasMove(deadBoard), false);
  const reshuffled = reshuffleCoinLinkBoard(deadBoard, "dead-seed", 1, 4);
  assert.deepEqual([...reshuffled].sort(), [...deadBoard].sort());
  assert.deepEqual(findCoinLinkMatches(reshuffled), []);
  assert.equal(coinLinkBoardHasMove(reshuffled), true);
  assert.deepEqual(
    reshuffled,
    reshuffleCoinLinkBoard(deadBoard, "dead-seed", 1, 4),
  );
});

test("recompensa exige a meta e respeita o teto econômico", () => {
  const target = coinLinkTargetScore(10);
  assert.equal(coinLinkRewardPower(10, target - 1), 0);
  assert.equal(coinLinkRewardPower(10, target + 100_000), 200);
});

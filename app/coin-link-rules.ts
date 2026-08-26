import { gameCoins, type GameCoinId } from "./game-coin-catalog.ts";
import {
  MAX_GAME_DIFFICULTY,
  gameCooldownSeconds,
  seededRandom,
} from "./packet-catch-rules.ts";

export const COIN_LINK_BOARD_SIZE = 6;
export const COIN_LINK_HOURLY_LIMIT = 6;
export const COIN_LINK_DAILY_LIMIT = 18;
export const COIN_LINK_POWER_DURATION_HOURS = 6;
export const COIN_LINK_MAX_MOVES = 24;
export const COIN_LINK_REWARD_POWER_CAP_GH = 200;

export type CoinLinkMove = {
  from: number;
  to: number;
  atMs: number;
};

export type CoinLinkMoveResult = {
  valid: boolean;
  board: GameCoinId[];
  score: number;
  cascades: number;
  steps: CoinLinkCascadeStep[];
  reshuffled?: boolean;
};

export type CoinLinkMatchGroup = {
  coinId: GameCoinId;
  direction: "horizontal" | "vertical";
  indices: number[];
  length: number;
};

export type CoinLinkCascadeStep = {
  cascade: number;
  boardBeforeClear: GameCoinId[];
  boardAfterRefill: GameCoinId[];
  matchedIndices: number[];
  groups: CoinLinkMatchGroup[];
  maxRun: number;
  score: number;
  sizeBonus: number;
};

const coinPoints = new Map(gameCoins.map((coin) => [coin.id, coin.points]));

function normalizedDifficulty(difficulty: number) {
  return Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
}

export function coinLinkDurationMs(difficulty: number) {
  const level = normalizedDifficulty(difficulty);
  return Math.max(32_000, 46_000 - (level - 1) * 1_100);
}

export function coinLinkTargetScore(difficulty: number) {
  const level = normalizedDifficulty(difficulty);
  return 260 + (level - 1) * 48;
}

export function coinLinkCoinPool(difficulty: number) {
  const level = normalizedDifficulty(difficulty);
  const poolSize = Math.min(7, 5 + Math.floor((level - 1) / 4));
  const valuableIndex = Math.min(
    gameCoins.length - 1,
    poolSize - 1 + Math.floor((level - 1) / 2),
  );
  const commonCoins = gameCoins
    .slice(0, poolSize - 1)
    .map((coin) => coin.id);
  return [...commonCoins, gameCoins[valuableIndex].id] satisfies GameCoinId[];
}

function isAdjacent(first: number, second: number) {
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 0 ||
    second < 0 ||
    first >= COIN_LINK_BOARD_SIZE ** 2 ||
    second >= COIN_LINK_BOARD_SIZE ** 2
  ) {
    return false;
  }
  const firstRow = Math.floor(first / COIN_LINK_BOARD_SIZE);
  const firstColumn = first % COIN_LINK_BOARD_SIZE;
  const secondRow = Math.floor(second / COIN_LINK_BOARD_SIZE);
  const secondColumn = second % COIN_LINK_BOARD_SIZE;
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
}

export function findCoinLinkMatchGroups(board: GameCoinId[]) {
  const groups: CoinLinkMatchGroup[] = [];
  for (let row = 0; row < COIN_LINK_BOARD_SIZE; row += 1) {
    let start = 0;
    while (start < COIN_LINK_BOARD_SIZE) {
      let end = start + 1;
      const value = board[row * COIN_LINK_BOARD_SIZE + start];
      while (
        end < COIN_LINK_BOARD_SIZE &&
        board[row * COIN_LINK_BOARD_SIZE + end] === value
      ) {
        end += 1;
      }
      if (value && end - start >= 3) {
        const indices = Array.from(
          { length: end - start },
          (_, offset) => row * COIN_LINK_BOARD_SIZE + start + offset,
        );
        groups.push({
          coinId: value,
          direction: "horizontal",
          indices,
          length: indices.length,
        });
      }
      start = end;
    }
  }

  for (let column = 0; column < COIN_LINK_BOARD_SIZE; column += 1) {
    let start = 0;
    while (start < COIN_LINK_BOARD_SIZE) {
      let end = start + 1;
      const value = board[start * COIN_LINK_BOARD_SIZE + column];
      while (
        end < COIN_LINK_BOARD_SIZE &&
        board[end * COIN_LINK_BOARD_SIZE + column] === value
      ) {
        end += 1;
      }
      if (value && end - start >= 3) {
        const indices = Array.from(
          { length: end - start },
          (_, offset) => (start + offset) * COIN_LINK_BOARD_SIZE + column,
        );
        groups.push({
          coinId: value,
          direction: "vertical",
          indices,
          length: indices.length,
        });
      }
      start = end;
    }
  }
  return groups;
}

export function findCoinLinkMatches(board: GameCoinId[]) {
  const matched = new Set(
    findCoinLinkMatchGroups(board).flatMap((group) => group.indices),
  );
  return [...matched].sort((first, second) => first - second);
}

function scoreCoinLinkCascade(
  board: GameCoinId[],
  groups: CoinLinkMatchGroup[],
  cascade: number,
) {
  const matchedIndices = [
    ...new Set(groups.flatMap((group) => group.indices)),
  ].sort((first, second) => first - second);
  const baseScore = matchedIndices.reduce(
    (total, index) => total + (coinPoints.get(board[index]) ?? 0),
    0,
  );
  const sizeBonus = groups.reduce((total, group) => {
    const extraCoins = Math.max(0, group.length - 3);
    return total + extraCoins * (coinPoints.get(group.coinId) ?? 0) * 2;
  }, 0);
  return {
    matchedIndices,
    sizeBonus,
    score: (baseScore + sizeBonus) * cascade,
  };
}

export function coinLinkBoardHasMove(board: GameCoinId[]) {
  for (let index = 0; index < board.length; index += 1) {
    for (const other of [index + 1, index + COIN_LINK_BOARD_SIZE]) {
      if (!isAdjacent(index, other)) continue;
      const swapped = [...board];
      [swapped[index], swapped[other]] = [swapped[other], swapped[index]];
      if (findCoinLinkMatches(swapped).length > 0) return true;
    }
  }
  return false;
}

function shuffleCoinLinkBoard(board: GameCoinId[], random: () => number) {
  const shuffled = [...board];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

/**
 * Reorganizes a dead board without changing its inventory of coins. The seed
 * and move index keep the result identical in the browser and on the server.
 */
export function reshuffleCoinLinkBoard(
  board: GameCoinId[],
  seed: string,
  difficulty: number,
  moveIndex: number,
) {
  if (
    board.length !== COIN_LINK_BOARD_SIZE ** 2 ||
    coinLinkBoardHasMove(board)
  ) {
    return board;
  }
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const candidate = shuffleCoinLinkBoard(
      board,
      seededRandom(
        `coin-link-reshuffle:${seed}:${difficulty}:${moveIndex}:${attempt}`,
      ),
    );
    if (
      findCoinLinkMatches(candidate).length === 0 &&
      coinLinkBoardHasMove(candidate)
    ) {
      return candidate;
    }
  }
  return board;
}

export function createCoinLinkBoard(seed: string, difficulty: number) {
  const pool = coinLinkCoinPool(difficulty);
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const random = seededRandom(`coin-link:${seed}:${difficulty}:${attempt}`);
    const board: GameCoinId[] = [];
    for (let index = 0; index < COIN_LINK_BOARD_SIZE ** 2; index += 1) {
      const row = Math.floor(index / COIN_LINK_BOARD_SIZE);
      const column = index % COIN_LINK_BOARD_SIZE;
      let choices = [...pool];
      if (
        column >= 2 &&
        board[index - 1] === board[index - 2]
      ) {
        choices = choices.filter((coin) => coin !== board[index - 1]);
      }
      if (
        row >= 2 &&
        board[index - COIN_LINK_BOARD_SIZE] ===
          board[index - COIN_LINK_BOARD_SIZE * 2]
      ) {
        choices = choices.filter(
          (coin) => coin !== board[index - COIN_LINK_BOARD_SIZE],
        );
      }
      board.push(choices[Math.floor(random() * choices.length)] ?? pool[0]);
    }
    if (coinLinkBoardHasMove(board)) return board;
  }
  throw new Error("Não foi possível montar um tabuleiro jogável.");
}

function collapseAndRefill(
  board: Array<GameCoinId | null>,
  seed: string,
  difficulty: number,
  moveIndex: number,
  cascade: number,
) {
  const pool = coinLinkCoinPool(difficulty);
  const random = seededRandom(
    `coin-link-refill:${seed}:${difficulty}:${moveIndex}:${cascade}`,
  );
  const next = [...board];
  for (let column = 0; column < COIN_LINK_BOARD_SIZE; column += 1) {
    const survivors: GameCoinId[] = [];
    for (let row = COIN_LINK_BOARD_SIZE - 1; row >= 0; row -= 1) {
      const coin = next[row * COIN_LINK_BOARD_SIZE + column];
      if (coin) survivors.push(coin);
    }
    let survivorIndex = 0;
    for (let row = COIN_LINK_BOARD_SIZE - 1; row >= 0; row -= 1) {
      next[row * COIN_LINK_BOARD_SIZE + column] =
        survivors[survivorIndex++] ??
        pool[Math.floor(random() * pool.length)] ??
        pool[0];
    }
  }
  return next as GameCoinId[];
}

export function applyCoinLinkMove(
  board: GameCoinId[],
  seed: string,
  difficulty: number,
  moveIndex: number,
  from: number,
  to: number,
): CoinLinkMoveResult {
  if (board.length !== COIN_LINK_BOARD_SIZE ** 2 || !isAdjacent(from, to)) {
    return { valid: false, board, score: 0, cascades: 0, steps: [] };
  }
  let next = [...board];
  [next[from], next[to]] = [next[to], next[from]];
  let groups = findCoinLinkMatchGroups(next);
  if (groups.length === 0) {
    return { valid: false, board, score: 0, cascades: 0, steps: [] };
  }

  let score = 0;
  let cascades = 0;
  const steps: CoinLinkCascadeStep[] = [];
  while (groups.length > 0 && cascades < 8) {
    cascades += 1;
    const boardBeforeClear = [...next];
    const cascadeScore = scoreCoinLinkCascade(next, groups, cascades);
    score += cascadeScore.score;
    const cleared: Array<GameCoinId | null> = [...next];
    for (const index of cascadeScore.matchedIndices) cleared[index] = null;
    next = collapseAndRefill(
      cleared,
      seed,
      difficulty,
      moveIndex,
      cascades,
    );
    steps.push({
      cascade: cascades,
      boardBeforeClear,
      boardAfterRefill: [...next],
      matchedIndices: cascadeScore.matchedIndices,
      groups,
      maxRun: Math.max(...groups.map((group) => group.length)),
      score: cascadeScore.score,
      sizeBonus: cascadeScore.sizeBonus,
    });
    groups = findCoinLinkMatchGroups(next);
  }
  const playableBoard = reshuffleCoinLinkBoard(
    next,
    seed,
    difficulty,
    moveIndex,
  );
  return {
    valid: true,
    board: playableBoard,
    score,
    cascades,
    steps,
    reshuffled: playableBoard !== next,
  };
}

export function validateCoinLink(
  seed: string,
  difficulty: number,
  events: CoinLinkMove[],
) {
  let board = createCoinLinkBoard(seed, difficulty);
  let score = 0;
  let lastEventAt = -1_000;

  for (const [moveIndex, event] of events.entries()) {
    if (
      !event ||
      typeof event !== "object" ||
      !Number.isInteger(event.from) ||
      !Number.isInteger(event.to) ||
      !Number.isInteger(event.atMs) ||
      event.atMs < 0 ||
      event.atMs < lastEventAt ||
      event.atMs - lastEventAt < 140
    ) {
      return { valid: false as const, reason: "Sequência de combinações inválida." };
    }
    const result = applyCoinLinkMove(
      board,
      seed,
      difficulty,
      moveIndex,
      event.from,
      event.to,
    );
    if (!result.valid) {
      return { valid: false as const, reason: "Troca sem combinação detectada." };
    }
    board = result.board;
    score += result.score;
    lastEventAt = event.atMs;
  }

  return {
    valid: true as const,
    board,
    score,
    completed: score >= coinLinkTargetScore(difficulty),
    lastEventAt,
  };
}

export function coinLinkRewardPower(difficulty: number, score: number) {
  const target = coinLinkTargetScore(difficulty);
  if (score < target) return 0;
  const level = normalizedDifficulty(difficulty);
  return Math.min(
    COIN_LINK_REWARD_POWER_CAP_GH,
    65 + level * 12 + Math.floor((score - target) / 18),
  );
}

export { gameCooldownSeconds };

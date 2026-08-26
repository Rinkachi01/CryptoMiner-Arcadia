import { ARCADE_DIFFICULTY_MAX } from "./arcade-progression-rules.ts";
import { gameCoins } from "./game-coin-catalog.ts";
import { gameCooldownSeconds, seededRandom } from "./packet-catch-rules.ts";

export const CRYPTO_2048_BOARD_SIZE = 4;
export const CRYPTO_2048_CELL_COUNT = CRYPTO_2048_BOARD_SIZE ** 2;
export const CRYPTO_2048_HOURLY_LIMIT = 6;
export const CRYPTO_2048_DAILY_LIMIT = 18;
export const CRYPTO_2048_MAX_EVENTS = 120;
export const CRYPTO_2048_POWER_DURATION_HOURS = 6;
export const CRYPTO_2048_REWARD_POWER_CAP_GH = 200;
/** Pontuação mínima autoritativa para concluir cada nível do Crypto 2048. */
export const CRYPTO_2048_TARGET_SCORE_BY_LEVEL = [0, 48, 160, 360, 720, 1_300] as const;

export type Crypto2048Cell = number | null;
export type Crypto2048Direction = "up" | "down" | "left" | "right";

export type Crypto2048Move = {
  direction: Crypto2048Direction;
  atMs: number;
};

export type Crypto2048MoveResult = {
  valid: boolean;
  board: Crypto2048Cell[];
  score: number;
  mergedRanks: number[];
  spawnedIndex: number | null;
  gameOver: boolean;
  maxRank: number;
};

export type Crypto2048ReplayResult = {
  valid: boolean;
  board: Crypto2048Cell[];
  score: number;
  maxRank: number;
  gameOver: boolean;
  lastMoveAt: number;
  moves: number;
  reason?: string;
};

export type Crypto2048RankInfo = {
  rank: number;
  symbol: string;
  name: string;
  asset?: string;
  color: string;
};

export const CRYPTO_2048_RANKS: Crypto2048RankInfo[] = [
  ["doge", "gold"],
  ["trx", "orange"],
  ["eth", "violet"],
  ["btc", "amber"],
  ["cma", "cyan"],
  ["ltc", "blue"],
  ["xrp", "lime"],
].map(([id, color], index) => {
  const coin = gameCoins.find((item) => item.id === id);
  if (!coin) throw new Error(`Moeda do Crypto 2048 não cadastrada: ${id}`);
  return {
    rank: index + 1,
    symbol: coin.symbol,
    name: coin.name,
    asset: coin.asset,
    color,
  } satisfies Crypto2048RankInfo;
}) as Crypto2048RankInfo[];

function normalizedDifficulty(difficulty: number) {
  return Math.min(ARCADE_DIFFICULTY_MAX, Math.max(1, Math.floor(difficulty || 1)));
}

function boardIsValid(board: Crypto2048Cell[]) {
  return board.length === CRYPTO_2048_CELL_COUNT && board.every(
    (cell) => cell === null || (Number.isInteger(cell) && cell >= 1),
  );
}

function maxBoardRank(board: Crypto2048Cell[]) {
  return board.reduce((highest, cell) => Math.max(highest, cell ?? 0), 0);
}

export function crypto2048DurationMs(difficulty: number) {
  const level = normalizedDifficulty(difficulty);
  return Math.max(30_000, 46_000 - (level - 1) * 1_200);
}

export function crypto2048TargetScore(difficulty: number) {
  const level = normalizedDifficulty(difficulty);
  return CRYPTO_2048_TARGET_SCORE_BY_LEVEL[level] ?? CRYPTO_2048_TARGET_SCORE_BY_LEVEL.at(-1)!;
}

export function crypto2048RewardPower(
  score: number,
  difficulty: number,
  maxRank: number,
) {
  const level = normalizedDifficulty(difficulty);
  const safeScore = Math.max(0, Math.floor(score));
  const safeRank = Math.max(1, Math.floor(maxRank || 1));
  return Math.min(
    CRYPTO_2048_REWARD_POWER_CAP_GH,
    Math.max(120, Math.round(120 + safeScore * 0.08 + level * 18 + safeRank * 15)),
  );
}

export function crypto2048CooldownSeconds(
  winsInLast24Hours: number,
  difficulty: number,
) {
  return gameCooldownSeconds(winsInLast24Hours, normalizedDifficulty(difficulty));
}

export function createCrypto2048Board(seed: string, difficulty = 1): Crypto2048Cell[] {
  const level = normalizedDifficulty(difficulty);
  const board: Crypto2048Cell[] = Array.from(
    { length: CRYPTO_2048_CELL_COUNT },
    () => null,
  );
  const random = seededRandom(`crypto-2048-initial:${seed}:${level}`);
  const firstIndex = Math.floor(random() * CRYPTO_2048_CELL_COUNT);
  let secondIndex = Math.floor(random() * CRYPTO_2048_CELL_COUNT);
  if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % CRYPTO_2048_CELL_COUNT;
  board[firstIndex] = 1;
  board[secondIndex] = 1;
  return board;
}

function slideLine(line: Crypto2048Cell[]) {
  const compact = line.filter((cell): cell is number => cell !== null);
  const next: Crypto2048Cell[] = [];
  const mergedRanks: number[] = [];
  let score = 0;
  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index];
    if (compact[index + 1] === current) {
      const merged = current + 1;
      next.push(merged);
      mergedRanks.push(merged);
      score += merged * merged * 4;
      index += 1;
    } else {
      next.push(current);
    }
  }
  while (next.length < CRYPTO_2048_BOARD_SIZE) next.push(null);
  return { line: next, score, mergedRanks };
}

function reverse<T>(values: T[]) {
  return [...values].reverse();
}

function hasChanged(first: Crypto2048Cell[], second: Crypto2048Cell[]) {
  return first.some((cell, index) => cell !== second[index]);
}

export function isCrypto2048GameOver(board: Crypto2048Cell[]) {
  if (!boardIsValid(board)) return false;
  if (board.some((cell) => cell === null)) return false;
  for (let row = 0; row < CRYPTO_2048_BOARD_SIZE; row += 1) {
    for (let column = 0; column < CRYPTO_2048_BOARD_SIZE; column += 1) {
      const index = row * CRYPTO_2048_BOARD_SIZE + column;
      for (const [rowOffset, columnOffset] of [[0, 1], [1, 0]] as const) {
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow >= CRYPTO_2048_BOARD_SIZE || nextColumn >= CRYPTO_2048_BOARD_SIZE) continue;
        if (board[index] === board[nextRow * CRYPTO_2048_BOARD_SIZE + nextColumn]) return false;
      }
    }
  }
  return true;
}

function lineForDirection(board: Crypto2048Cell[], lineIndex: number, direction: Crypto2048Direction) {
  if (direction === "left" || direction === "right") {
    const start = lineIndex * CRYPTO_2048_BOARD_SIZE;
    const line = board.slice(start, start + CRYPTO_2048_BOARD_SIZE);
    return direction === "right" ? reverse(line) : line;
  }
  const line = Array.from(
    { length: CRYPTO_2048_BOARD_SIZE },
    (_, offset) => board[offset * CRYPTO_2048_BOARD_SIZE + lineIndex],
  );
  return direction === "down" ? reverse(line) : line;
}

function writeLine(
  board: Crypto2048Cell[],
  lineIndex: number,
  direction: Crypto2048Direction,
  line: Crypto2048Cell[],
) {
  const values = direction === "right" || direction === "down" ? reverse(line) : line;
  if (direction === "left" || direction === "right") {
    const start = lineIndex * CRYPTO_2048_BOARD_SIZE;
    values.forEach((cell, offset) => { board[start + offset] = cell; });
    return;
  }
  values.forEach((cell, offset) => {
    board[offset * CRYPTO_2048_BOARD_SIZE + lineIndex] = cell;
  });
}

export function applyCrypto2048Move(
  board: Crypto2048Cell[],
  seed: string,
  difficulty: number,
  moveIndex: number,
  direction: Crypto2048Direction,
): Crypto2048MoveResult {
  if (!boardIsValid(board) || !["up", "down", "left", "right"].includes(direction)) {
    return { valid: false, board, score: 0, mergedRanks: [], spawnedIndex: null, gameOver: false, maxRank: maxBoardRank(board) };
  }
  const next = [...board];
  let score = 0;
  const mergedRanks: number[] = [];
  for (let lineIndex = 0; lineIndex < CRYPTO_2048_BOARD_SIZE; lineIndex += 1) {
    const original = lineForDirection(board, lineIndex, direction);
    const collapsed = slideLine(original);
    score += collapsed.score;
    mergedRanks.push(...collapsed.mergedRanks);
    writeLine(next, lineIndex, direction, collapsed.line);
  }
  if (!hasChanged(board, next)) {
    return { valid: false, board: [...board], score: 0, mergedRanks: [], spawnedIndex: null, gameOver: isCrypto2048GameOver(board), maxRank: maxBoardRank(board) };
  }
  const empty = next.flatMap((cell, index) => cell === null ? [index] : []);
  let spawnedIndex: number | null = null;
  if (empty.length > 0) {
    const random = seededRandom(`crypto-2048-spawn:${seed}:${normalizedDifficulty(difficulty)}:${moveIndex}`);
    spawnedIndex = empty[Math.floor(random() * empty.length)] ?? empty[0];
    next[spawnedIndex] = 1;
  }
  return {
    valid: true,
    board: next,
    score,
    mergedRanks,
    spawnedIndex,
    gameOver: isCrypto2048GameOver(next),
    maxRank: maxBoardRank(next),
  };
}

export function replayCrypto2048(
  seed: string,
  difficulty: number,
  events: Crypto2048Move[],
): Crypto2048ReplayResult {
  if (!Array.isArray(events) || events.length > CRYPTO_2048_MAX_EVENTS) {
    return { valid: false, board: [], score: 0, maxRank: 0, gameOver: false, lastMoveAt: -1, moves: 0, reason: "Sequência de movimentos inválida." };
  }
  let board = createCrypto2048Board(seed, difficulty);
  let score = 0;
  let lastMoveAt = -1;
  for (const [moveIndex, event] of events.entries()) {
    if (!event || !["up", "down", "left", "right"].includes(event.direction) || !Number.isInteger(event.atMs) || event.atMs < 0 || event.atMs < lastMoveAt || event.atMs - lastMoveAt < 80) {
      return { valid: false, board, score, maxRank: maxBoardRank(board), gameOver: isCrypto2048GameOver(board), lastMoveAt, moves: moveIndex, reason: "Sequência de movimentos inválida." };
    }
    if (isCrypto2048GameOver(board)) {
      return { valid: false, board, score, maxRank: maxBoardRank(board), gameOver: true, lastMoveAt, moves: moveIndex, reason: "A partida já estava encerrada." };
    }
    const result = applyCrypto2048Move(board, seed, difficulty, moveIndex, event.direction);
    if (!result.valid) {
      return { valid: false, board, score, maxRank: maxBoardRank(board), gameOver: result.gameOver, lastMoveAt, moves: moveIndex, reason: "Movimento sem alteração no tabuleiro." };
    }
    board = result.board;
    score += result.score;
    lastMoveAt = event.atMs;
  }
  return { valid: true, board, score, maxRank: maxBoardRank(board), gameOver: isCrypto2048GameOver(board), lastMoveAt, moves: events.length };
}

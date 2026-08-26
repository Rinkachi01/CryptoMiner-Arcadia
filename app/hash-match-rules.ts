import { gameCoins, getGameCoin, type GameCoinId } from "./game-coin-catalog.ts";
import {
  MAX_GAME_DIFFICULTY,
  gameCooldownSeconds,
  seededRandom,
} from "./packet-catch-rules.ts";

export const HASH_MATCH_HOURLY_LIMIT = 6;
export const HASH_MATCH_DAILY_LIMIT = 18;
export const HASH_MATCH_POWER_DURATION_HOURS = 6;
export const HASH_MATCH_REWARD_POWER_CAP_GH = 200;

export type HashCard = {
  id: string;
  coinId: GameCoinId;
};

export type HashMatchProof = {
  deck: HashCard[];
  openCardId: string | null;
  matchedCardIds: string[];
  moves: number;
  lastFlipAt: number;
};

export function hashMatchPairCount(difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  return Math.min(8, 4 + Math.floor((level - 1) / 2));
}

export function hashMatchDurationMs(difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  // The reveal is server-authoritative and can take a network round trip.
  // Keep enough room for the full board while still shortening higher levels.
  return Math.max(75_000, 105_000 - (level - 1) * 3_500);
}

export function createHashMatchProof(
  seed: string,
  difficulty: number,
): HashMatchProof {
  const random = seededRandom(`hash-match:${seed}:${difficulty}`);
  const selected = [...gameCoins]
    .sort(() => random() - 0.5)
    .slice(0, hashMatchPairCount(difficulty));
  const deck = selected
    .flatMap((coin, pairIndex) => [
      { id: `card-${pairIndex + 1}-a`, coinId: coin.id },
      { id: `card-${pairIndex + 1}-b`, coinId: coin.id },
    ])
    .sort(() => random() - 0.5);
  return {
    deck,
    openCardId: null,
    matchedCardIds: [],
    moves: 0,
    lastFlipAt: 0,
  };
}

export function revealHashCard(proof: HashMatchProof, cardId: string) {
  const card = proof.deck.find((item) => item.id === cardId);
  const coin = card ? getGameCoin(card.coinId) : undefined;
  return card && coin
    ? {
        cardId: card.id,
        coinId: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        asset: coin.asset,
        points: coin.points,
      }
    : null;
}

export function hashMatchRewardPower(
  difficulty: number,
  pairs: number,
  moves: number,
) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  const idealMoves = pairs;
  const extraMoves = Math.max(0, moves - idealMoves);
  return Math.max(
    60,
    Math.min(
      HASH_MATCH_REWARD_POWER_CAP_GH,
      65 + pairs * 15 + level * 12 - extraMoves * 4,
    ),
  );
}

export { gameCooldownSeconds };

import { gameCoins, type GameCoinId } from "./game-coin-catalog.ts";

export const PACKET_CATCH_DURATION_MS = 30_000;
export const PACKET_CATCH_HOURLY_LIMIT = 8;
export const PACKET_CATCH_DAILY_LIMIT = 24;
export const PACKET_CATCH_POWER_DURATION_HOURS = 6;
export const MAX_GAME_DIFFICULTY = 10;

export type PacketTarget = {
  id: string;
  lane: number;
  appearsAtMs: number;
  lifetimeMs: number;
  kind: "coin" | "bomb";
  coinId?: GameCoinId;
  symbol?: string;
  asset?: string;
  points: number;
};

export type PacketCatchEvent = {
  targetId: string;
  atMs: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pickWeightedCoin(random: () => number) {
  const totalWeight = gameCoins.reduce((sum, coin) => sum + coin.weight, 0);
  let cursor = random() * totalWeight;
  for (const coin of gameCoins) {
    cursor -= coin.weight;
    if (cursor <= 0) return coin;
  }
  return gameCoins[0];
}

export function packetTargetLifetime(difficulty: number) {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  return Math.max(880, 1_750 - (level - 1) * 85);
}

export function createPacketTargets(
  seed: string,
  difficulty = 1,
): PacketTarget[] {
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  const random = seededRandom(`${seed}:${level}`);
  const intervalMs = Math.max(690, 1_420 - (level - 1) * 78);
  const lifetimeMs = packetTargetLifetime(level);
  const bombChance = Math.min(0.29, 0.08 + (level - 1) * 0.024);
  const targets: PacketTarget[] = [];
  let appearsAtMs = 900;
  let index = 0;

  while (appearsAtMs < PACKET_CATCH_DURATION_MS - lifetimeMs - 250) {
    const isBomb = random() < bombChance;
    const coin = isBomb ? undefined : pickWeightedCoin(random);
    targets.push({
      id: `packet-${index + 1}`,
      lane: Math.floor(random() * 5),
      appearsAtMs: Math.floor(appearsAtMs),
      lifetimeMs,
      kind: isBomb ? "bomb" : "coin",
      coinId: coin?.id,
      symbol: coin?.symbol,
      asset: coin?.asset,
      points: coin?.points ?? 0,
    });
    appearsAtMs += intervalMs + Math.floor(random() * 210);
    index += 1;
  }

  return targets;
}

export function scorePacketCatch(
  seed: string,
  difficulty: number,
  events: PacketCatchEvent[],
) {
  const targets = createPacketTargets(seed, difficulty);
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const clicked = new Set<string>();
  let score = 0;
  let coinHits = 0;
  let bombHit = false;
  let lastEventAt = -1_000;

  for (const [index, event] of events.entries()) {
    const target = targetMap.get(event.targetId);
    if (
      !target ||
      clicked.has(event.targetId) ||
      !Number.isInteger(event.atMs) ||
      event.atMs < target.appearsAtMs ||
      event.atMs > target.appearsAtMs + target.lifetimeMs ||
      event.atMs < lastEventAt ||
      event.atMs - lastEventAt < 75
    ) {
      return { valid: false as const, reason: "Sequência de cliques inválida." };
    }

    clicked.add(event.targetId);
    lastEventAt = event.atMs;
    if (target.kind === "bomb") {
      if (index !== events.length - 1) {
        return {
          valid: false as const,
          reason: "A partida continuou depois de uma bomba.",
        };
      }
      bombHit = true;
      score = 0;
    } else {
      score += target.points;
      coinHits += 1;
    }
  }

  return {
    valid: true as const,
    score: bombHit ? 0 : score,
    coinHits,
    bombHit,
    lastEventAt,
  };
}

export function packetCatchRewardPower(
  score: number,
  difficulty: number,
  bombHit: boolean,
) {
  if (bombHit || score < 20) return 0;
  const level = Math.min(MAX_GAME_DIFFICULTY, Math.max(1, difficulty));
  return Math.min(320, Math.round(35 + score * 0.82 + level * 11));
}

export function gameCooldownSeconds(
  winsInLast24Hours: number,
  difficulty: number,
) {
  const activityCooldown =
    winsInLast24Hours < 3
      ? 45
      : winsInLast24Hours < 7
        ? 75
        : winsInLast24Hours < 12
          ? 120
          : winsInLast24Hours < 18
            ? 180
            : 300;
  return activityCooldown + Math.max(0, difficulty - 1) * 8;
}

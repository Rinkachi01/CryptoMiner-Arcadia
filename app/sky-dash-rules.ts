import { ARCADE_DIFFICULTY_MAX, normalizeArcadeDifficulty } from "./arcade-progression-rules.ts";

export const SKY_DASH_GAME_ID = "sky-dash" as const;
export const SKY_DASH_HOURLY_LIMIT = 6;
export const SKY_DASH_DAILY_LIMIT = 18;
export const SKY_DASH_MAX_EVENTS = 36;
export const SKY_DASH_REWARD_POWER_CAP_GH = 180;
/** Normalized aircraft collision geometry used by both client and server. */
export const SKY_DASH_AIRCRAFT_HALF_HEIGHT = 0.035;
export const SKY_DASH_BOUNDARY_MARGIN = 0.028;
export const SKY_DASH_GATE_PADDING = 0.014;

export type SkyDashObstacle = {
  id: string;
  index: number;
  appearsAtMs: number;
  crossesAtMs: number;
  gapTop: number;
  gapBottom: number;
};

export type SkyDashEvent = {
  obstacleId: string;
  atMs: number;
  altitude: number;
  /** A collision consumes a life but does not clear the obstacle. */
  result?: "clear" | "collision";
};

const DIFFICULTY = [
  { durationMs: 40_000, obstacles: 10, gap: 0.34, travelMs: 3_200 },
  { durationMs: 42_000, obstacles: 14, gap: 0.31, travelMs: 2_900 },
  { durationMs: 45_000, obstacles: 18, gap: 0.28, travelMs: 2_650 },
  { durationMs: 48_000, obstacles: 24, gap: 0.25, travelMs: 2_450 },
  { durationMs: 52_000, obstacles: 30, gap: 0.22, travelMs: 2_300 },
] as const;

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function skyDashConfig(difficulty: number) {
  return DIFFICULTY[normalizeArcadeDifficulty(difficulty) - 1];
}

export function createSkyDashObstacles(
  seed: string,
  difficulty = 1,
): SkyDashObstacle[] {
  const level = normalizeArcadeDifficulty(difficulty);
  const config = skyDashConfig(level);
  const random = seededRandom(`${seed}:${level}`);
  const obstacles: SkyDashObstacle[] = [];
  let previousCenter = 0.5;

  for (let index = 0; index < config.obstacles; index += 1) {
    const center = Math.max(
      config.gap / 2 + 0.04,
      Math.min(
        0.96 - config.gap / 2,
        previousCenter + (random() - 0.5) * (0.28 - level * 0.015),
      ),
    );
    previousCenter = center;
    const gapTop = center - config.gap / 2;
    const appearsAtMs = 2_400 + index * Math.max(1_050, config.travelMs * 0.74);
    obstacles.push({
      id: `sky-${index + 1}`,
      index,
      appearsAtMs: Math.floor(appearsAtMs),
      crossesAtMs: Math.floor(appearsAtMs + config.travelMs),
      gapTop,
      gapBottom: center + config.gap / 2,
    });
  }
  return obstacles;
}

export function isSkyDashAltitudeSafe(
  altitude: number,
  gapTop?: number,
  gapBottom?: number,
) {
  if (!Number.isFinite(altitude)) return false;
  const topBoundary = SKY_DASH_BOUNDARY_MARGIN + SKY_DASH_AIRCRAFT_HALF_HEIGHT;
  const bottomBoundary = 1 - SKY_DASH_BOUNDARY_MARGIN - SKY_DASH_AIRCRAFT_HALF_HEIGHT;
  if (altitude < topBoundary || altitude > bottomBoundary) return false;
  if (gapTop === undefined || gapBottom === undefined) return true;
  return (
    altitude - SKY_DASH_AIRCRAFT_HALF_HEIGHT >= gapTop + SKY_DASH_GATE_PADDING &&
    altitude + SKY_DASH_AIRCRAFT_HALF_HEIGHT <= gapBottom - SKY_DASH_GATE_PADDING
  );
}

export function isSkyDashCollision(
  altitude: number,
  gapTop?: number,
  gapBottom?: number,
) {
  return !isSkyDashAltitudeSafe(altitude, gapTop, gapBottom);
}

export function validateSkyDash(
  seed: string,
  difficulty: number,
  events: SkyDashEvent[],
) {
  const obstacles = createSkyDashObstacles(seed, difficulty);
  if (events.length < obstacles.length || events.length > obstacles.length + 2) {
    return { valid: false as const, reason: "Todos os vãos precisam ser validados." };
  }
  let lastAtMs = -1;
  let obstacleIndex = 0;
  let collisions = 0;
  for (const event of events) {
    const obstacle = obstacles[obstacleIndex];
    if (
      !obstacle ||
      event.obstacleId !== obstacle.id ||
      !Number.isInteger(event.atMs) ||
      event.atMs <= lastAtMs ||
      !Number.isFinite(event.altitude) ||
      event.altitude < 0 ||
      event.altitude > 1
    ) {
      return { valid: false as const, reason: "Trajetória do Sky Dash inválida." };
    }
    const result = event.result ?? "clear";
    if (result !== "clear" && result !== "collision") {
      return { valid: false as const, reason: "Resultado de colisão do Sky Dash inválido." };
    }
    if (result === "collision") {
      if (event.atMs < 0 || event.atMs > obstacle.crossesAtMs + 1_100 || collisions >= 2) {
        return { valid: false as const, reason: "Número de colisões do Sky Dash inválido." };
      }
      collisions += 1;
    } else {
      if (event.atMs < obstacle.crossesAtMs - 950 ||
          event.atMs > obstacle.crossesAtMs + 1_100 ||
          !isSkyDashAltitudeSafe(event.altitude, obstacle.gapTop, obstacle.gapBottom)) {
        return { valid: false as const, reason: "Trajetória do Sky Dash inválida." };
      }
      obstacleIndex += 1;
    }
    lastAtMs = event.atMs;
  }
  if (obstacleIndex !== obstacles.length) {
    return { valid: false as const, reason: "Todos os vãos precisam ser validados." };
  }
  return {
    valid: true as const,
    cleared: obstacles.length,
    collisions,
    lastEventAt: lastAtMs,
  };
}

export function skyDashRewardPower(difficulty: number, cleared: number) {
  const level = normalizeArcadeDifficulty(difficulty);
  return Math.min(
    SKY_DASH_REWARD_POWER_CAP_GH,
    Math.round(110 + level * 24 + cleared * 3),
  );
}

export function skyDashDifficultyLabel(difficulty: number) {
  const level = Math.max(1, Math.min(ARCADE_DIFFICULTY_MAX, Math.floor(difficulty)));
  return `N${level}`;
}

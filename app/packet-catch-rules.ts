export const PACKET_CATCH_DURATION_MS = 32_000;
export const PACKET_CATCH_TARGET_LIFETIME_MS = 1_850;
export const PACKET_CATCH_HOURLY_LIMIT = 5;
export const PACKET_CATCH_DAILY_LIMIT = 15;
export const PACKET_CATCH_POWER_DURATION_HOURS = 6;

export type PacketTarget = {
  id: string;
  lane: number;
  appearsAtMs: number;
  kind: "valid" | "corrupt";
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

function randomGenerator(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createPacketTargets(seed: string): PacketTarget[] {
  const random = randomGenerator(seed);
  return Array.from({ length: 18 }, (_, index) => {
    const kind = random() < 0.74 ? "valid" : "corrupt";
    return {
      id: `packet-${index + 1}`,
      lane: Math.floor(random() * 5),
      appearsAtMs: 1_050 + index * 1_540 + Math.floor(random() * 320),
      kind,
      points: kind === "valid" ? 8 + Math.floor(random() * 7) : -12,
    };
  });
}

export function scorePacketCatch(
  seed: string,
  events: PacketCatchEvent[],
) {
  const targets = createPacketTargets(seed);
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const clicked = new Set<string>();
  let score = 0;
  let validHits = 0;
  let corruptHits = 0;
  let lastEventAt = -1_000;

  for (const event of events) {
    const target = targetMap.get(event.targetId);
    if (
      !target ||
      clicked.has(event.targetId) ||
      !Number.isInteger(event.atMs) ||
      event.atMs < target.appearsAtMs ||
      event.atMs > target.appearsAtMs + PACKET_CATCH_TARGET_LIFETIME_MS ||
      event.atMs < lastEventAt ||
      event.atMs - lastEventAt < 80
    ) {
      return { valid: false as const, reason: "Sequência de cliques inválida." };
    }

    clicked.add(event.targetId);
    lastEventAt = event.atMs;
    score += target.points;
    if (target.kind === "valid") validHits += 1;
    else corruptHits += 1;
  }

  return {
    valid: true as const,
    score: Math.max(0, score),
    validHits,
    corruptHits,
  };
}

export function packetCatchRewardPower(score: number) {
  if (score >= 125) return 240;
  if (score >= 80) return 160;
  if (score >= 40) return 90;
  return 0;
}

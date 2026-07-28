import type { PublicGameState } from "./game-server.ts";

export const STARTER_KIT_VERSION = "operator-v2";

export type OnboardingLedgerEvent = {
  action: string;
  metadata?: Record<string, unknown>;
};

export type OnboardingMilestones = {
  kitDelivered: boolean;
  energyOnline: boolean;
  minerInstalled: boolean;
  poolsConfirmed: boolean;
  arcadeCompleted: boolean;
  firstBlockCredited: boolean;
};

export type OnboardingStatus = {
  version: string | null;
  eligible: boolean;
  completed: boolean;
  completedCount: number;
  totalSteps: number;
  milestones: OnboardingMilestones;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function hasPositiveBlockReward(event: OnboardingLedgerEvent) {
  if (event.action !== "block_settlement") return false;
  const rewards = record(event.metadata?.rewards);
  return ["cma", "btc", "doge"].some((symbol) => {
    const value = Number(rewards[symbol] ?? 0);
    return Number.isFinite(value) && value > 0;
  });
}

export function buildOnboardingStatus(
  state: PublicGameState,
  events: OnboardingLedgerEvent[],
  completedArcadeGames: number,
  now: number,
): OnboardingStatus {
  const starterEvent = events.find(
    (event) => event.action === "starter_kit_granted",
  );
  const starterMetadata = record(starterEvent?.metadata);
  const version =
    typeof starterMetadata.version === "string"
      ? starterMetadata.version
      : null;
  const milestones: OnboardingMilestones = {
    kitDelivered: Boolean(starterEvent),
    energyOnline:
      state.energyExpiresAt > now ||
      events.some(
        (event) =>
          event.action === "claim_energy" || event.action === "use_battery",
      ),
    minerInstalled:
      Object.values(state.rackMiners).some((placements) => placements.length > 0) ||
      events.some((event) => event.action === "install_miner"),
    poolsConfirmed: events.some(
      (event) => event.action === "apply_allocations",
    ),
    arcadeCompleted: completedArcadeGames >= 3,
    firstBlockCredited: events.some(hasPositiveBlockReward),
  };
  const completedCount = Object.values(milestones).filter(Boolean).length;
  const totalSteps = Object.keys(milestones).length;
  return {
    version,
    eligible: version === STARTER_KIT_VERSION,
    completed: completedCount === totalSteps,
    completedCount,
    totalSteps,
    milestones,
  };
}

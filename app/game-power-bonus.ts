/**
 * Calibration for the optional power bonus awarded after a validated win.
 *
 * The normal game reward is calculated by each server-side ruleset. This
 * separate drop is intentionally small and infrequent so it cannot become the
 * dominant source of temporary mining power. It still consumes the shared
 * daily emission budget in game-emission-budget.ts.
 */
export const BONUS_POWER_DROP_CHANCE = 0.12;
export const BONUS_POWER_DROP_REQUEST_GH = 150;

export function shouldAwardBonusPower(randomValue = Math.random) {
  const roll = randomValue();
  return Number.isFinite(roll) && roll >= 0 && roll < BONUS_POWER_DROP_CHANCE;
}

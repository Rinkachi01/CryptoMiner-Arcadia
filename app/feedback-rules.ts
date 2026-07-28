export const betaFeedbackCategories = [
  "interface",
  "racks",
  "economy",
  "minigames",
  "tasks",
] as const;

export type BetaFeedbackCategory =
  (typeof betaFeedbackCategories)[number];

export function isBetaFeedbackCategory(
  value: unknown,
): value is BetaFeedbackCategory {
  return betaFeedbackCategories.includes(value as BetaFeedbackCategory);
}

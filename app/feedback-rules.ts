export const betaFeedbackCategories = [
  "interface",
  "racks",
  "economy",
  "minigames",
  "tasks",
] as const;

export const betaFeedbackStatuses = [
  "new",
  "reviewing",
  "planned",
  "resolved",
] as const;

export type BetaFeedbackCategory =
  (typeof betaFeedbackCategories)[number];
export type BetaFeedbackStatus = (typeof betaFeedbackStatuses)[number];

export function isBetaFeedbackCategory(
  value: unknown,
): value is BetaFeedbackCategory {
  return betaFeedbackCategories.includes(value as BetaFeedbackCategory);
}

export function isBetaFeedbackStatus(
  value: unknown,
): value is BetaFeedbackStatus {
  return betaFeedbackStatuses.includes(value as BetaFeedbackStatus);
}

// A small curated set of emoji for personalizing a savings goal — kept as
// plain emoji (no icon library) since it's stored as a simple text column.
export const GOAL_ICON_OPTIONS = ['🎯', '🏠', '✈️', '🚗', '🎓', '💍', '👶', '🏖️', '💻', '🎁'] as const;

export type GoalIcon = (typeof GOAL_ICON_OPTIONS)[number];

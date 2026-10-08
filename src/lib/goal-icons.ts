// MaterialCommunityIcons names for personalizing a savings goal — replaces
// the previous plain-emoji set (see CLAUDE.md: no emoji anywhere, icons only).
export const GOAL_ICON_OPTIONS = [
  'target',
  'home',
  'airplane',
  'car',
  'school',
  'ring',
  'baby',
  'beach',
  'laptop',
  'gift',
] as const;

export type GoalIcon = (typeof GOAL_ICON_OPTIONS)[number];

// Goals created before this change stored a plain emoji in the `icon`
// column. Checked the live database on 2026-09-13 — no existing rows
// currently hold one of these (both goals in production are `icon: null`) —
// but this keeps any that slip through (an older client, a restored
// backup) rendering the right picture instead of falling back to generic.
const LEGACY_EMOJI_TO_ICON: Record<string, GoalIcon> = {
  '🎯': 'target',
  '🏠': 'home',
  '✈️': 'airplane',
  '🚗': 'car',
  '🎓': 'school',
  '💍': 'ring',
  '👶': 'baby',
  '🏖️': 'beach',
  '💻': 'laptop',
  '🎁': 'gift',
};

// Normalizes a goal's stored `icon` value — a current icon name, a legacy
// emoji, or null/unrecognized — to a valid GoalIcon, or null if there's
// nothing usable. Callers should fall back to a generic icon in that case.
export function normalizeGoalIcon(value: string | null | undefined): GoalIcon | null {
  if (!value) return null;
  if ((GOAL_ICON_OPTIONS as readonly string[]).includes(value)) return value as GoalIcon;
  return LEGACY_EMOJI_TO_ICON[value] ?? null;
}

// Keyword -> icon rules for suggesting a goal's icon from its name, checked
// in order (most specific first) so e.g. "Beach trip" lands on beach rather
// than airplane. Falls back to 'target' when nothing matches.
const NAME_KEYWORD_RULES: [RegExp, GoalIcon][] = [
  [/\b(beach|resort)\b/i, 'beach'],
  [/\b(trip|travel|flight|vacation|holiday|honeymoon)\b/i, 'airplane'],
  [/\b(wedding|engagement|marry|marriage)\b/i, 'ring'],
  [/\b(baby|child|kid|nursery)\b/i, 'baby'],
  [/\b(school|college|university|tuition|course|degree|education)\b/i, 'school'],
  [/\b(car|vehicle|auto)\b/i, 'car'],
  [/\b(home|house|apartment|rent|mortgage)\b/i, 'home'],
  [/\b(laptop|macbook|computer|pc|phone|gadget|tech)\b/i, 'laptop'],
  [/\b(gift|present)\b/i, 'gift'],
];

// Suggests an icon for a new goal based on keywords in its name, so it
// starts with something more useful than the generic default. The user can
// still override it by tapping a different icon in the picker.
export function suggestGoalIcon(name: string): GoalIcon {
  for (const [pattern, icon] of NAME_KEYWORD_RULES) {
    if (pattern.test(name)) return icon;
  }
  return 'target';
}

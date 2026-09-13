-- Lets a goal be personalized with a small emoji, shown on its card on Home.
-- Nullable/no default: existing goals just fall back to a plain icon badge.
alter table public.saving_goals add column icon text;

import { addDays, addMonths } from '@/lib/dates';

export type RepeatInterval = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';

export const REPEAT_INTERVAL_OPTIONS: { value: RepeatInterval; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly' },
];

export function repeatIntervalLabel(interval: string) {
  return REPEAT_INTERVAL_OPTIONS.find((option) => option.value === interval)?.label ?? 'Does not repeat';
}

// Advances a due date to the next occurrence for a given repeat interval.
export function advanceDueDate(date: Date, interval: RepeatInterval) {
  switch (interval) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonths(date, 1);
    case 'bimonthly':
      return addMonths(date, 2);
    case 'quarterly':
      return addMonths(date, 3);
    case 'yearly':
      return addMonths(date, 12);
    case 'none':
      return date;
  }
}

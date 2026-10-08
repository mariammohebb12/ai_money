// Builds a "YYYY-MM-DD" string from a Date's local year/month/day, avoiding the
// day shifting backward the way Date.toISOString() would for negative UTC offsets.
export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parses a "YYYY-MM-DD" string (as stored in Postgres `date` columns) as a local
// date. `new Date("YYYY-MM-DD")` parses as UTC midnight, which can display as the
// previous day in negative UTC-offset timezones — this avoids that.
export function fromDateString(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + amount);
  return result;
}

// A time-of-day greeting — "Good morning/afternoon/evening" — shared by any
// screen that opens with one, so it always matches the device's actual clock.
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Describes a due date relative to today, e.g. for a bill's due_date.
export function describeDueDate(dueDate: Date) {
  const diffDays = Math.round((dueDate.getTime() - startOfToday().getTime()) / 86400000);
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, isOverdue: true };
  }
  if (diffDays === 0) {
    return { label: 'Due today', isOverdue: false };
  }
  return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, isOverdue: false };
}

export function pad(n: number): string {
  return `${n < 10 ? '0' : ''}${n}`;
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: string): Date {
  const [year = 0, month = 1, day = 1] = s.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function addMonths(d: Date, n: number): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + n);
  return next;
}

export function startOfWeek(d: Date): Date {
  const next = new Date(d);
  const dayOfWeek = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - dayOfWeek);
  next.setHours(12, 0, 0, 0);
  return next;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Always renders day before month (e.g. "5 Jun"), independent of browser locale.
export function fmtShortDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

// Always renders day before month with a full year (e.g. "5 Jun 2026").
export function fmtShortDateYear(d: Date): string {
  return `${fmtShortDate(d)} ${d.getFullYear()}`;
}

// Always renders "June 2026" (month-year has no day-ordering ambiguity).
export function fmtMonthYear(d: Date): string {
  return `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Always renders "Monday, 5 June 2026" — day before month, independent of locale.
export function fmtFullDate(d: Date): string {
  return `${LONG_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

// Inclusive [from, to] ISO bounds for the first/last day of the month
// containing `d`.
export function monthBounds(d: Date): { from: string; to: string } {
  const year = d.getFullYear();
  const month0 = d.getMonth();
  return {
    from: iso(new Date(year, month0, 1, 12)),
    to: iso(new Date(year, month0, daysInMonth(year, month0), 12)),
  };
}

// Timesheet export default period: the current month once we're within its
// last 3 days (hours are usually already filled in by then), otherwise the
// previous month.
export function defaultExportPeriod(today: Date): { from: string; to: string } {
  const daysLeft = daysInMonth(today.getFullYear(), today.getMonth()) - today.getDate();
  const reference = daysLeft < 3 ? today : addMonths(today, -1);
  return monthBounds(reference);
}

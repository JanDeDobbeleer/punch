// Converts a user-typed hours value (e.g. "2.5") to whole minutes. Returns
// NaN for non-numeric input so callers can validate.
export function hoursToMinutes(hours: string): number {
  if (hours.trim() === '') {
    return NaN;
  }
  const value = Number(hours);
  return Number.isFinite(value) ? Math.round(value * 60) : NaN;
}

// Renders a duration in minutes as a decimal hours string for a form field
// (e.g. 150 -> "2.5", 60 -> "1").
export function minutesToHours(min: number): string {
  const hours = Math.round((min / 60) * 100) / 100;
  return String(hours);
}

export function fmtH(min: number): string {
  const hours = min / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}

// Renders a duration in minutes as a decimal number of days (e.g. "2.5d"),
// given the number of hours that make up one working day.
export function fmtDays(min: number, hoursPerDay: number): string {
  const days = min / 60 / hoursPerDay;
  const rounded = Math.round(days * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}d`;
}

export function fmtEUR(n: number): string {
  return `€${Math.round(n).toLocaleString('en-US')}`;
}

// Renders days unrounded (up to 5 decimals, no suffix) so that days x day rate
// reproduces the billed amount. Number() normalises "-0" and String() only uses
// exponent notation below 1e-6, which the 5-decimal rounding rules out.
export function fmtDaysExact(min: number, hoursPerDay: number): string {
  const days = Math.round((min / 60 / hoursPerDay) * 1e5) / 1e5;
  return String(days === 0 ? 0 : days);
}

// Like fmtEUR but keeps the cents (e.g. "€8,401.25").
export function fmtEURCents(n: number): string {
  const cents = Math.round(n * 100) / 100;
  return `€${cents.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hexToRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function fmtBytes(bytes: number): string {
  if (!bytes || bytes < 1024) {
    return `${bytes || 0} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function uid(): string {
  return `x${Math.random().toString(36).slice(2, 9)}`;
}

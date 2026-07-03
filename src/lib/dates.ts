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

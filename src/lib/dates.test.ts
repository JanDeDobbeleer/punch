import { describe, expect, test } from 'vitest';

import { addDays, addMonths, iso, pad, parseISO, startOfWeek } from './dates';

describe('dates helpers', () => {
  test('pad prefixes single digits', () => {
    expect(pad(3)).toBe('03');
    expect(pad(12)).toBe('12');
  });

  test('iso round-trips with parseISO', () => {
    const value = '2026-07-01';
    expect(iso(parseISO(value))).toBe(value);
  });

  test('addDays and addMonths return shifted dates', () => {
    expect(iso(addDays(parseISO('2026-07-01'), 3))).toBe('2026-07-04');
    expect(iso(addMonths(parseISO('2026-07-01'), 2))).toBe('2026-09-01');
  });

  test('startOfWeek returns Monday at noon', () => {
    const result = startOfWeek(parseISO('2026-07-02'));
    expect(iso(result)).toBe('2026-06-29');
    expect(result.getHours()).toBe(12);
  });
});

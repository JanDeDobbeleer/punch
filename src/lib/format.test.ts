import { describe, expect, test, vi } from 'vitest';

import { fmtDaysExact, fmtEUR, fmtEURCents, fmtH, hexToRgba, hoursToMinutes, minutesToHours, uid } from './format';

describe('format helpers', () => {
  test('hoursToMinutes converts decimal hours to integer minutes', () => {
    expect(hoursToMinutes('2.5')).toBe(150);
    expect(hoursToMinutes('1')).toBe(60);
    expect(hoursToMinutes('0.25')).toBe(15);
    expect(Number.isNaN(hoursToMinutes(''))).toBe(true);
    expect(Number.isNaN(hoursToMinutes('abc'))).toBe(true);
  });

  test('minutesToHours renders minutes back to an hours string', () => {
    expect(minutesToHours(150)).toBe('2.5');
    expect(minutesToHours(60)).toBe('1');
    expect(minutesToHours(15)).toBe('0.25');
  });

  test('fmtH formats whole and fractional hours', () => {
    expect(fmtH(120)).toBe('2h');
    expect(fmtH(90)).toBe('1.5h');
  });

  test('fmtEUR rounds and localizes', () => {
    expect(fmtEUR(1234.4)).toBe('€1,234');
    expect(fmtEUR(1234.5)).toBe('€1,235');
  });

  test('fmtDaysExact keeps up to 5 decimals without trailing zeros', () => {
    expect(fmtDaysExact(444, 8)).toBe('0.925');
    expect(fmtDaysExact(360, 8)).toBe('0.75');
    expect(fmtDaysExact(480, 8)).toBe('1');
    expect(fmtDaysExact(0, 8)).toBe('0');
    expect(fmtDaysExact(20, 8)).toBe('0.04167');
    expect(fmtDaysExact(456, 7.6)).toBe('1');
    expect(fmtDaysExact(300, 7.6)).toBe('0.65789');
  });

  test('fmtEURCents always shows two decimals', () => {
    expect(fmtEURCents(8401.25)).toBe('€8,401.25');
    expect(fmtEURCents(1234.5)).toBe('€1,234.50');
    expect(fmtEURCents(0.1 + 0.2)).toBe('€0.30');
    expect(fmtEURCents(0)).toBe('€0.00');
  });

  test('exact days x day rate reproduces the billed amount', () => {
    const earn = (6204 / 60 / 8) * 650;
    expect(fmtEURCents(Number(fmtDaysExact(6204, 8)) * 650)).toBe(fmtEURCents(earn));
  });

  test('hexToRgba expands hex channels', () => {
    expect(hexToRgba('#2563eb', 0.5)).toBe('rgba(37,99,235,0.5)');
  });

  test('uid uses the expected prefix', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    expect(uid()).toMatch(/^x[a-z0-9]{1,7}$/);
    vi.restoreAllMocks();
  });
});

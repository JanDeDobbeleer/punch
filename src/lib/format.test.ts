import { describe, expect, test, vi } from 'vitest';

import { fmtEUR, fmtH, fmtMin, hexToRgba, parseHM, uid } from './format';

describe('format helpers', () => {
  test('fmtMin and parseHM convert clock values', () => {
    expect(fmtMin(545)).toBe('09:05');
    expect(parseHM('09:05')).toBe(545);
  });

  test('fmtH formats whole and fractional hours', () => {
    expect(fmtH(120)).toBe('2h');
    expect(fmtH(90)).toBe('1.5h');
  });

  test('fmtEUR rounds and localizes', () => {
    expect(fmtEUR(1234.4)).toBe('€1,234');
    expect(fmtEUR(1234.5)).toBe('€1,235');
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

// Time-bound project rate helpers. Rate periods never overlap: the period
// with `to: null` is the currently active ("open") one. Adding a new rate
// closes the previously open period the day before the new period starts.

import type { RatePeriod } from '../types.js';
import { addDays, iso, parseISO } from './dates.js';

export function sortRates(rates: RatePeriod[]): RatePeriod[] {
  return rates.slice().sort((a, b) => a.from.localeCompare(b.from));
}

export function dayBeforeISO(dateISO: string): string {
  return iso(addDays(parseISO(dateISO), -1));
}

// The currently active rate period: the open one (to === null), or -
// failing that - the one with the latest `from` date.
export function currentRatePeriod(rates: RatePeriod[]): RatePeriod | undefined {
  const open = rates.find((rate) => rate.to === null);
  if (open) {
    return open;
  }

  return sortRates(rates).at(-1);
}

// Resolve the rate that applies on a given date. Falls back to the current
// (open) rate when no period covers the date, e.g. entries logged before the
// project's first rate period.
export function rateForDate(rates: RatePeriod[], dateISO: string): number {
  const period = rates.find((rate) => rate.from <= dateISO && (rate.to === null || dateISO <= rate.to));
  if (period) {
    return period.amount;
  }

  return currentRatePeriod(rates)?.amount ?? 0;
}

// Add a new open-ended rate period starting on `from`, automatically
// closing the previously open period the day before. Returns the rates
// unchanged if `from` would not leave a valid (non-empty) period for the
// period being closed.
export function addRatePeriod(rates: RatePeriod[], id: string, amount: number, from: string): RatePeriod[] {
  const open = rates.find((rate) => rate.to === null);
  if (open && dayBeforeISO(from) < open.from) {
    return rates;
  }

  const closed = rates.map((rate) => (rate.to === null ? { ...rate, to: dayBeforeISO(from) } : rate));
  return [...closed, { id, amount, from, to: null }];
}

// True when any two periods overlap, or when more than one period is open.
export function hasOverlap(rates: RatePeriod[]): boolean {
  const sorted = sortRates(rates);
  const openCount = sorted.filter((rate) => rate.to === null).length;
  if (openCount > 1) {
    return true;
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEnd = current.to ?? '9999-12-31';
    if (currentEnd >= next.from) {
      return true;
    }
  }

  return false;
}

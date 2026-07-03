import { pad } from './dates';

export function fmtMin(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function parseHM(s: string): number {
  const [hours = 0, minutes = 0] = (s || '0:0').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function fmtH(min: number): string {
  const hours = min / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}

export function fmtEUR(n: number): string {
  return `€${Math.round(n).toLocaleString('en-US')}`;
}

export function hexToRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function uid(): string {
  return `x${Math.random().toString(36).slice(2, 9)}`;
}

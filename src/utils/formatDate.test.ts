import { describe, it, expect } from 'vitest';
import { formatDate, toDatetimeLocal } from './formatDate';

describe('formatDate', () => {
  it('zero-pads single-digit day and month', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('formats double-digit day and month without extra padding', () => {
    expect(formatDate(new Date(2026, 11, 25))).toBe('25/12/2026');
  });

  it('handles year boundaries correctly', () => {
    expect(formatDate(new Date(1999, 11, 31))).toBe('31/12/1999');
    expect(formatDate(new Date(2000, 0, 1))).toBe('01/01/2000');
  });
});

describe('toDatetimeLocal', () => {
  it('formats a date as the datetime-local string in local time', () => {
    expect(toDatetimeLocal(new Date(2026, 5, 20, 14, 30))).toBe('2026-06-20T14:30');
  });

  it('zero-pads month, day, hour and minute', () => {
    expect(toDatetimeLocal(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });

  it('round-trips back to the same instant via new Date()', () => {
    const original = new Date(2026, 2, 9, 8, 5);
    expect(new Date(toDatetimeLocal(original)).getTime()).toBe(original.getTime());
  });
});

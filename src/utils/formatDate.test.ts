import { describe, it, expect } from 'vitest';
import { formatDate } from './formatDate';

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

import { describe, it, expect } from 'vitest';
import { formatMPG, formatCostPerMile, formatKmL, formatL100km, getNumericMPG, getNumericFuelPrice } from './calculations';

describe('Calculation Utilities', () => {
  describe('formatMPG', () => {
    it('calculates MPG correctly', () => {
      // 100km = 62.1371 miles
      // 10L = 2.19969 UK gallons
      // MPG = ~28.25
      expect(formatMPG(100, 10)).toBe('28.25');
    });

    it('returns N/A for invalid inputs', () => {
      expect(formatMPG(0, 10)).toBe('N/A');
      expect(formatMPG(100, 0)).toBe('N/A');
      expect(formatMPG(-1, 10)).toBe('N/A');
    });
  });

  describe('formatCostPerMile', () => {
    it('calculates cost per mile correctly', () => {
       // Cost 10, distance 100km (62.137 miles) -> 0.1609...
       expect(formatCostPerMile(10, 100)).toBe('€0.161');
    });

    it('returns N/A for invalid inputs', () => {
      expect(formatCostPerMile(0, 100)).toBe('N/A');
      expect(formatCostPerMile(10, 0)).toBe('N/A');
    });
  });

  describe('formatKmL', () => {
    it('calculates km/L correctly', () => {
      expect(formatKmL(100, 10)).toBe('10.00');
    });
  });

   describe('formatL100km', () => {
    it('calculates L/100km correctly', () => {
      expect(formatL100km(100, 10)).toBe('10.00');
      expect(formatL100km(50, 5)).toBe('10.00');
      expect(formatL100km(200, 10)).toBe('5.00');
    });
  });

  describe('getNumericMPG', () => {
      it('returns numeric MPG', () => {
          const result = getNumericMPG(100, 10);
          expect(result).toBeCloseTo(28.248, 3);
      });

      it('returns null for invalid input', () => {
          expect(getNumericMPG(0, 10)).toBeNull();
      });
  });

  describe('getNumericFuelPrice', () => {
      it('returns numeric fuel price', () => {
          expect(getNumericFuelPrice(20, 10)).toBe(2);
      });

       it('returns null for invalid input', () => {
          expect(getNumericFuelPrice(0, 10)).toBeNull();
      });
  });
});

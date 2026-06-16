import { describe, it, expect } from 'vitest';
import { formatMPG, formatCostPerMile, formatKmL, formatL100km, getNumericMPG, getNumericFuelPrice, calculateDistance, getMonthlyTotals } from './calculations';

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

  describe('calculateDistance', () => {
    it('calculates distance between two odometer readings', () => {
      expect(calculateDistance(1000, 900)).toBe(100);
    });

    it('returns null if current is less than previous', () => {
      expect(calculateDistance(800, 900)).toBeNull();
    });

    it('allows zero as a valid reading', () => {
      expect(calculateDistance(100, 0)).toBe(100);
    });

    it('returns null for negative values', () => {
      expect(calculateDistance(-1, 100)).toBeNull();
      expect(calculateDistance(100, -1)).toBeNull();
    });
  });

  describe('getMonthlyTotals', () => {
    const log = (year: number, month: number, day: number, cost: number, litres: number) => ({
      timestamp: { toDate: () => new Date(year, month - 1, day) },
      cost,
      fuelAmountLiters: litres,
    });

    it('zero-fills months with no logs', () => {
      const referenceDate = new Date(2024, 5, 15); // June 2024
      const result = getMonthlyTotals([], 6, referenceDate);

      expect(result).toHaveLength(6);
      expect(result.map(r => r.monthKey)).toEqual([
        '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
      ]);
      result.forEach(bucket => {
        expect(bucket.totalCost).toBe(0);
        expect(bucket.totalLitres).toBe(0);
        expect(bucket.logCount).toBe(0);
      });
    });

    it('aggregates cost, litres, and count per month', () => {
      const referenceDate = new Date(2024, 5, 15); // June 2024
      const logs = [
        log(2024, 6, 1, 50, 30),
        log(2024, 6, 15, 40, 25),
        log(2024, 5, 1, 60, 35),
      ];

      const result = getMonthlyTotals(logs, 6, referenceDate);

      const june = result.find(r => r.monthKey === '2024-06');
      const may = result.find(r => r.monthKey === '2024-05');

      expect(june).toMatchObject({ totalCost: 90, totalLitres: 55, logCount: 2 });
      expect(may).toMatchObject({ totalCost: 60, totalLitres: 35, logCount: 1 });
    });

    it('excludes logs outside the requested window', () => {
      const referenceDate = new Date(2024, 5, 15); // June 2024
      const logs = [log(2023, 1, 1, 999, 999)]; // Over a year before the window

      const result = getMonthlyTotals(logs, 6, referenceDate);

      expect(result.every(bucket => bucket.logCount === 0)).toBe(true);
    });

    it('returns months ordered oldest to newest', () => {
      const referenceDate = new Date(2024, 0, 15); // January 2024, exercises year rollover
      const result = getMonthlyTotals([], 3, referenceDate);

      expect(result.map(r => r.monthKey)).toEqual(['2023-11', '2023-12', '2024-01']);
    });
  });
});

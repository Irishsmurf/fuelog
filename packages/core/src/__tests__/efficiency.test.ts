import { describe, it, expect } from 'vitest';
import {
  mpgUK, kmPerLitre, litresPer100km, pricePerLitre, costPerKm, costPerMile, distanceFromOdometer,
} from '../index.js';

describe('efficiency', () => {
  it('computes the standard metrics', () => {
    expect(kmPerLitre(500, 40)).toBe(12.5);
    expect(litresPer100km(500, 40)).toBe(8);
    expect(pricePerLitre(60, 40)).toBe(1.5);
    expect(costPerKm(60, 500)).toBeCloseTo(0.12);
    expect(costPerMile(10, 100)).toBeCloseTo(0.1609, 4);
    // 500 km on 40 L ≈ 35.31 MPG (UK)
    expect(mpgUK(500, 40)).toBeCloseTo(35.31, 2);
  });

  it('returns null for zero, negative, missing or non-finite input', () => {
    for (const fn of [mpgUK, kmPerLitre, litresPer100km, pricePerLitre, costPerKm, costPerMile]) {
      expect(fn(0, 10)).toBeNull();
      expect(fn(10, 0)).toBeNull();
      expect(fn(-1, 10)).toBeNull();
      expect(fn(Number.NaN, 10)).toBeNull();
      expect(fn(10, Number.POSITIVE_INFINITY)).toBeNull();
      expect(fn(undefined as unknown as number, 10)).toBeNull();
    }
  });

  it('kmPerLitre and litresPer100km are reciprocal (×100)', () => {
    for (const [d, l] of [[123.4, 9.8], [812, 61.2], [1, 1]]) {
      expect(kmPerLitre(d, l)! * litresPer100km(d, l)!).toBeCloseTo(100, 10);
    }
  });
});

describe('distanceFromOdometer', () => {
  it('returns the increase between readings', () => {
    expect(distanceFromOdometer(12500, 12000)).toBe(500);
  });

  it('rejects readings that do not increase', () => {
    expect(distanceFromOdometer(12000, 12000)).toBeNull();
    expect(distanceFromOdometer(11000, 12000)).toBeNull();
  });

  it('rejects negative or non-finite readings', () => {
    expect(distanceFromOdometer(-1, 0)).toBeNull();
    expect(distanceFromOdometer(100, -5)).toBeNull();
    expect(distanceFromOdometer(Number.NaN, 0)).toBeNull();
  });
});

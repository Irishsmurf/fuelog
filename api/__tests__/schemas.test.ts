import { describe, it, expect } from 'vitest';
import {
  logCreateSchema, logUpdateSchema, vehicleCreateSchema, vehicleUpdateSchema,
  parseLimit, MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT,
} from '../_schemas';

const validLog = { brand: 'Circle K', cost: 60, distanceKm: 500, fuelAmountLiters: 40 };

describe('logCreateSchema', () => {
  it('accepts a minimal valid log', () => {
    expect(logCreateSchema.safeParse(validLog).success).toBe(true);
  });

  it('rejects strings where numbers are expected', () => {
    expect(logCreateSchema.safeParse({ ...validLog, cost: '60' }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { brand: _b, ...rest } = validLog;
    void _b;
    expect(logCreateSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid dates instead of throwing later', () => {
    expect(logCreateSchema.safeParse({ ...validLog, timestamp: 'not-a-date' }).success).toBe(false);
    expect(logCreateSchema.safeParse({ ...validLog, timestamp: '2026-11-01T10:00:00Z' }).success).toBe(true);
  });

  it('rejects out-of-range coordinates and non-positive litres', () => {
    expect(logCreateSchema.safeParse({ ...validLog, latitude: 91 }).success).toBe(false);
    expect(logCreateSchema.safeParse({ ...validLog, longitude: -181 }).success).toBe(false);
    expect(logCreateSchema.safeParse({ ...validLog, fuelAmountLiters: 0 }).success).toBe(false);
  });

  it('strips fields outside the allowlist (userId, stationId, ...)', () => {
    const parsed = logCreateSchema.parse({ ...validLog, userId: 'victim', stationId: 'x', receiptUrl: 'y' });
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('stationId');
    expect(parsed).not.toHaveProperty('receiptUrl');
  });
});

describe('logUpdateSchema', () => {
  it('allows partial updates and strips internal fields', () => {
    const parsed = logUpdateSchema.parse({ cost: 70, userId: 'victim', id: 'abc' });
    expect(parsed).toEqual({ cost: 70 });
  });

  it('still type-checks provided fields', () => {
    expect(logUpdateSchema.safeParse({ distanceKm: 'far' }).success).toBe(false);
  });
});

describe('vehicle schemas', () => {
  const vehicle = { name: 'Daily', make: 'Toyota', model: 'Corolla', year: 2019, fuelType: 'Hybrid' };

  it('accepts a numeric year and stores it as a string', () => {
    expect(vehicleCreateSchema.parse(vehicle).year).toBe('2019');
  });

  it('rejects unknown fuel types', () => {
    expect(vehicleCreateSchema.safeParse({ ...vehicle, fuelType: 'Coal' }).success).toBe(false);
  });

  it('update strips userId and accepts isArchived', () => {
    expect(vehicleUpdateSchema.parse({ isArchived: true, userId: 'victim' })).toEqual({ isArchived: true });
  });
});

describe('parseLimit', () => {
  it('defaults for missing or invalid values', () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIST_LIMIT);
    expect(parseLimit('abc')).toBe(DEFAULT_LIST_LIMIT);
    expect(parseLimit('-5')).toBe(DEFAULT_LIST_LIMIT);
  });

  it('caps large values', () => {
    expect(parseLimit('1000000')).toBe(MAX_LIST_LIMIT);
    expect(parseLimit('25')).toBe(25);
  });
});

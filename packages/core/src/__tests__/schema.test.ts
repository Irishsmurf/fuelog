import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createFuelLogSchema, vehicleSchema, stationSchema, userProfileSchema, createApiTokenSchema } from '../index.js';

const ts = z.custom<{ toDate(): Date }>((v) => typeof (v as { toDate?: unknown })?.toDate === 'function');
const now = { toDate: () => new Date() };
const fuelLog = createFuelLogSchema(ts);

describe('fuel log schema', () => {
  const legacy = { userId: 'u', timestamp: now, brand: 'Esso', cost: 50, distanceKm: 400, fuelAmountLiters: 35 };

  it('accepts legacy documents without v2 fields', () => {
    expect(fuelLog.safeParse(legacy).success).toBe(true);
  });

  it('accepts v2 fields', () => {
    expect(fuelLog.safeParse({ ...legacy, fillType: 'partial', missedPrevious: false, source: 'api', schemaVersion: 2 }).success).toBe(true);
  });

  it('rejects wrong types', () => {
    expect(fuelLog.safeParse({ ...legacy, cost: '50' }).success).toBe(false);
    expect(fuelLog.safeParse({ ...legacy, timestamp: '2026-01-01' }).success).toBe(false);
    expect(fuelLog.safeParse({ ...legacy, fillType: 'half' }).success).toBe(false);
  });
});

describe('other schemas', () => {
  it('vehicle: numeric legacy year becomes a string; isDefault defaults false', () => {
    const v = vehicleSchema.parse({ userId: 'u', name: 'n', make: 'm', model: 'x', year: 2019, fuelType: 'Diesel' });
    expect(v.year).toBe('2019');
    expect(v.isDefault).toBe(false);
  });

  it('station: logCount defaults to 0', () => {
    expect(stationSchema.parse({ osmId: 'node/1', name: 'S', latitude: 1, longitude: 2 }).logCount).toBe(0);
  });

  it('profile: defaults home currency', () => {
    expect(userProfileSchema.parse({}).homeCurrency).toBe('EUR');
  });

  it('api token: nullable lastUsedAt', () => {
    const tok = createApiTokenSchema(ts);
    expect(tok.safeParse({ userId: 'u', name: 'n', tokenPrefix: 'flog_abcd', scopes: ['read:logs'], createdAt: now, lastUsedAt: null, isRevoked: false }).success).toBe(true);
  });
});

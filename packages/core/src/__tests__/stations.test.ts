import { describe, it, expect } from 'vitest';
import { localizeStation } from '../index.js';

const legacy = { avgPrice: 1.6, lastPrice: 1.7, logCount: 12 };
const bucket = (count: number, avgPrice: number, lastPrice: number | null) => ({ count, total: avgPrice * count, avgPrice, lastPrice, lastAt: 1 });

describe('localizeStation', () => {
  it('keeps legacy aggregates for stations without priceStats (not yet migrated)', () => {
    expect(localizeStation(legacy, 'EUR')).toEqual(legacy);
  });

  it('uses only the viewer currency bucket', () => {
    const s = { ...legacy, priceStats: { EUR: bucket(3, 1.55, 1.6), GBP: bucket(2, 1.4, 1.45) } };
    expect(localizeStation(s, 'GBP')).toMatchObject({ avgPrice: 1.4, lastPrice: 1.45, logCount: 2 });
  });

  it('shows no price rather than another currency when the viewer bucket is missing', () => {
    const s = { ...legacy, priceStats: { GBP: bucket(2, 1.4, 1.45) } };
    expect(localizeStation(s, 'EUR')).toMatchObject({ avgPrice: undefined, lastPrice: undefined, logCount: 0 });
  });
});

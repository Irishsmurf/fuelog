import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTrendChartData, buildVehicleComparison, fetchVehicleComparison, windowStart } from '../stats';
import { getLifetimeStats } from '../../firebase/aggregationService';
import type { Log, Vehicle } from '../../utils/types';

vi.mock('../../firebase/aggregationService', () => ({ getLifetimeStats: vi.fn() }));

const stats = (totalCost: number, totalLitres: number, totalDistanceKm: number, logCount: number) =>
  ({ totalCost, totalLitres, totalDistanceKm, logCount });
const vehicle = (id: string) => ({ id, name: `Car ${id}` }) as Vehicle;

describe('windowStart', () => {
  it('is the first of the month, monthsBack - 1 months ago', () => {
    expect(windowStart(6, new Date(2026, 10, 17, 15))).toEqual(new Date(2026, 5, 1));
    expect(windowStart(1, new Date(2026, 0, 31))).toEqual(new Date(2026, 0, 1));
    expect(windowStart(6, new Date(2026, 1, 10))).toEqual(new Date(2025, 8, 1));
  });
});

describe('buildVehicleComparison', () => {
  it('computes L/100km, cost per litre and spend per vehicle with logs', () => {
    const rows = buildVehicleComparison([
      { vehicle: vehicle('a'), stats: stats(100, 50, 500, 5) },
      { vehicle: vehicle('b'), stats: stats(200, 80, 800, 8) },
      { vehicle: vehicle('c'), stats: stats(0, 0, 0, 0) },
    ]);
    expect(rows).toEqual([
      { vehicleId: 'a', name: 'Car a', avgL100km: 10, avgCostPerLitre: 2, totalSpend: 100 },
      { vehicleId: 'b', name: 'Car b', avgL100km: 10, avgCostPerLitre: 2.5, totalSpend: 200 },
    ]);
  });

  it('returns nothing to compare when fewer than two vehicles have logs', () => {
    expect(buildVehicleComparison([
      { vehicle: vehicle('a'), stats: stats(100, 50, 500, 5) },
      { vehicle: vehicle('b'), stats: stats(0, 0, 0, 0) },
    ])).toEqual([]);
  });

  it('avoids dividing by zero', () => {
    const rows = buildVehicleComparison([
      { vehicle: vehicle('a'), stats: stats(10, 0, 0, 1) },
      { vehicle: vehicle('b'), stats: stats(10, 0, 0, 1) },
    ]);
    expect(rows[0]).toMatchObject({ avgL100km: 0, avgCostPerLitre: 0 });
  });
});

describe('fetchVehicleComparison', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads lifetime stats per vehicle', async () => {
    vi.mocked(getLifetimeStats).mockImplementation(async (_u, id) => (id === 'a' ? stats(100, 50, 500, 5) : stats(200, 80, 800, 8)));
    const rows = await fetchVehicleComparison('u1', [vehicle('a'), vehicle('b')]);
    expect(getLifetimeStats).toHaveBeenCalledWith('u1', 'a');
    expect(getLifetimeStats).toHaveBeenCalledWith('u1', 'b');
    expect(rows).toHaveLength(2);
  });

  it('does not query with a single vehicle', async () => {
    expect(await fetchVehicleComparison('u1', [vehicle('a')])).toEqual([]);
    expect(getLifetimeStats).not.toHaveBeenCalled();
  });
});

describe('buildTrendChartData', () => {
  const at = (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms });
  const log = (ms: number, cost: number, distanceKm: number, fuelAmountLiters: number) =>
    ({ id: String(ms), timestamp: at(ms), cost, distanceKm, fuelAmountLiters }) as unknown as Log;

  it('sorts oldest first and derives price per litre', () => {
    const data = buildTrendChartData([log(2000, 60, 300, 30), log(1000, 50, 400, 25)]);
    expect(data.map(d => d.timestampValue)).toEqual([1000, 2000]);
    expect(data[0].fuelPrice).toBeCloseTo(2);
    expect(data[1].cost).toBe(60);
  });

  it('nulls out a zero cost', () => {
    expect(buildTrendChartData([log(1000, 0, 400, 25)])[0].cost).toBeNull();
  });

  it('is empty for no logs', () => {
    expect(buildTrendChartData([])).toEqual([]);
  });
});

// Dashboard statistics: server-side lifetime aggregates plus the pure
// transforms the dashboard charts use. No React; hooks are in statsHooks.ts.
import { getLifetimeStats, type LifetimeStats } from '../firebase/aggregationService';
import { getNumericFuelPrice, getNumericMPG } from '../utils/calculations';
import { formatDate } from '../utils/formatDate';
import type { ChartDataPoint, Log, Vehicle } from '../utils/types';

export { getLifetimeStats, type LifetimeStats };

export interface VehicleComparisonDatum {
  vehicleId: string;
  name: string;
  avgL100km: number;
  avgCostPerLitre: number;
  totalSpend: number;
}

/** First day (local) of the month `monthsBack - 1` months before `now`'s month. */
export function windowStart(monthsBack: number, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
}

/**
 * Per-vehicle comparison rows. Only vehicles with logs count, and fewer than
 * two such vehicles means there is nothing to compare (empty result).
 */
export function buildVehicleComparison(results: { vehicle: Vehicle; stats: LifetimeStats }[]): VehicleComparisonDatum[] {
  const withLogs = results.filter(({ stats }) => stats.logCount > 0);
  if (withLogs.length < 2) return [];
  return withLogs.map(({ vehicle, stats }) => ({
    vehicleId: vehicle.id,
    name: vehicle.name,
    avgL100km: stats.totalDistanceKm > 0 ? (stats.totalLitres / stats.totalDistanceKm) * 100 : 0,
    avgCostPerLitre: stats.totalLitres > 0 ? stats.totalCost / stats.totalLitres : 0,
    totalSpend: stats.totalCost,
  }));
}

/** Lifetime stats for each vehicle, as comparison rows. */
export async function fetchVehicleComparison(userId: string, vehicles: Vehicle[]): Promise<VehicleComparisonDatum[]> {
  if (vehicles.length < 2) return [];
  const results = await Promise.all(
    vehicles.map(vehicle => getLifetimeStats(userId, vehicle.id).then(stats => ({ vehicle, stats }))),
  );
  return buildVehicleComparison(results);
}

/** One chart point per log, oldest first. */
export function buildTrendChartData(logs: Log[]): ChartDataPoint[] {
  if (logs.length === 0) return [];
  return [...logs]
    .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis())
    .map(log => ({
      date: log.timestamp?.toDate() ? formatDate(log.timestamp.toDate()) : 'N/A',
      timestampValue: log.timestamp?.toMillis(),
      mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters),
      cost: log.cost > 0 ? log.cost : null,
      fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters),
    }));
}

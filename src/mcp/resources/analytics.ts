import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAdminDb } from '../firebase-admin.js';
import { calcMPG, calcKmL, calcL100km, calcFuelPrice } from '../calculations.js';
import type { ServerLog, AnalyticsSummary, MonthlyDataPoint, VehicleStats } from '../types.js';

async function fetchAllLogs(userId: string): Promise<ServerLog[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('fuelLogs')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerLog));
}

function computeSummary(logs: ServerLog[], homeCurrency: string): AnalyticsSummary {
  if (logs.length === 0) {
    return {
      totalLogs: 0, totalSpent: 0, homeCurrency, totalFuelLiters: 0, totalDistanceKm: 0,
      averageEfficiency: { kml: null, l100km: null, mpg: null },
      averageCostPerLiter: null,
      dateRange: { from: null, to: null },
    };
  }
  const totalSpent = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
  const totalFuelLiters = logs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
  const totalDistanceKm = logs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);
  const sorted = [...logs].sort((a, b) => a.timestamp?.toMillis?.() - b.timestamp?.toMillis?.());
  return {
    totalLogs: logs.length,
    totalSpent: Math.round(totalSpent * 100) / 100,
    homeCurrency,
    totalFuelLiters: Math.round(totalFuelLiters * 100) / 100,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    averageEfficiency: {
      kml: calcKmL(totalDistanceKm, totalFuelLiters),
      l100km: calcL100km(totalDistanceKm, totalFuelLiters),
      mpg: calcMPG(totalDistanceKm, totalFuelLiters),
    },
    averageCostPerLiter: calcFuelPrice(totalSpent, totalFuelLiters),
    dateRange: {
      from: sorted[0]?.timestamp?.toDate?.()?.toISOString()?.slice(0, 10) ?? null,
      to: sorted[sorted.length - 1]?.timestamp?.toDate?.()?.toISOString()?.slice(0, 10) ?? null,
    },
  };
}

function computeMonthly(logs: ServerLog[]): MonthlyDataPoint[] {
  const byMonth = new Map<string, ServerLog[]>();
  for (const log of logs) {
    const date = log.timestamp?.toDate?.();
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(log);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthLogs]) => {
      const totalSpent = monthLogs.reduce((s, l) => s + (l.cost ?? 0), 0);
      const totalLiters = monthLogs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
      const totalDistanceKm = monthLogs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);
      return {
        month,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalLiters: Math.round(totalLiters * 100) / 100,
        totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
        logCount: monthLogs.length,
        avgEfficiencyKml: calcKmL(totalDistanceKm, totalLiters),
        avgCostPerLiter: calcFuelPrice(totalSpent, totalLiters),
      };
    });
}

function computeVehicleStats(logs: ServerLog[], vehicleMap: Map<string, string>): VehicleStats[] {
  const byVehicle = new Map<string, ServerLog[]>();
  for (const log of logs) {
    const vid = log.vehicleId ?? '__unknown__';
    if (!byVehicle.has(vid)) byVehicle.set(vid, []);
    byVehicle.get(vid)!.push(log);
  }
  return [...byVehicle.entries()].map(([vehicleId, vLogs]) => {
    const totalSpent = vLogs.reduce((s, l) => s + (l.cost ?? 0), 0);
    const totalLiters = vLogs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
    const totalDistanceKm = vLogs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);
    return {
      vehicleId,
      vehicleName: vehicleMap.get(vehicleId) ?? (vehicleId === '__unknown__' ? 'Unknown vehicle' : vehicleId),
      logCount: vLogs.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalLiters: Math.round(totalLiters * 100) / 100,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      avgEfficiencyKml: calcKmL(totalDistanceKm, totalLiters),
      avgMpg: calcMPG(totalDistanceKm, totalLiters),
      avgCostPerLiter: calcFuelPrice(totalSpent, totalLiters),
    };
  });
}

export function registerAnalyticsResources(server: McpServer, userId: string) {
  server.registerResource(
    'analytics-summary',
    'fuelog://analytics/summary',
    { description: 'Aggregated lifetime stats: total spend, distance, liters, average efficiency', mimeType: 'application/json' },
    async () => {
      const db = getAdminDb();
      const [logs, profileDoc] = await Promise.all([
        fetchAllLogs(userId),
        db.collection('userProfiles').doc(userId).get(),
      ]);
      const homeCurrency = profileDoc.exists ? (profileDoc.data()?.homeCurrency ?? 'EUR') : 'EUR';
      const summary = computeSummary(logs, homeCurrency);
      return { contents: [{ uri: 'fuelog://analytics/summary', mimeType: 'application/json', text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.registerResource(
    'analytics-monthly',
    'fuelog://analytics/monthly',
    { description: 'Month-by-month breakdown of fuel spend, distance, and efficiency', mimeType: 'application/json' },
    async () => {
      const logs = await fetchAllLogs(userId);
      const monthly = computeMonthly(logs);
      return { contents: [{ uri: 'fuelog://analytics/monthly', mimeType: 'application/json', text: JSON.stringify(monthly, null, 2) }] };
    }
  );

  server.registerResource(
    'analytics-vehicles',
    'fuelog://analytics/vehicles',
    { description: 'Per-vehicle fuel efficiency and cost statistics', mimeType: 'application/json' },
    async () => {
      const db = getAdminDb();
      const [logs, vehiclesSnapshot] = await Promise.all([
        fetchAllLogs(userId),
        db.collection('vehicles').where('userId', '==', userId).get(),
      ]);
      const vehicleMap = new Map<string, string>();
      vehiclesSnapshot.docs.forEach(d => vehicleMap.set(d.id, d.data().name ?? d.id));
      const stats = computeVehicleStats(logs, vehicleMap);
      return { contents: [{ uri: 'fuelog://analytics/vehicles', mimeType: 'application/json', text: JSON.stringify(stats, null, 2) }] };
    }
  );
}

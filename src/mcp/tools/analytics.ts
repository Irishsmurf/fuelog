import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin.js';
import { calcMPG, calcKmL, calcL100km, calcFuelPrice } from '../calculations.js';
import type { ServerLog } from '../types.js';

async function fetchLogs(userId: string, opts: { vehicleId?: string; startDate?: string; endDate?: string } = {}): Promise<ServerLog[]> {
  const db = getAdminDb();
  let q = db.collection('fuelLogs')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc') as FirebaseFirestore.Query;
  if (opts.vehicleId) q = q.where('vehicleId', '==', opts.vehicleId);
  if (opts.startDate) q = q.where('timestamp', '>=', Timestamp.fromDate(new Date(opts.startDate)));
  if (opts.endDate) q = q.where('timestamp', '<=', Timestamp.fromDate(new Date(opts.endDate + 'T23:59:59Z')));
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServerLog));
}

export function registerAnalyticsTools(server: McpServer, userId: string) {
  server.registerTool('get_analytics', {
    description: 'Compute fuel efficiency and cost statistics for a time period or vehicle.',
    inputSchema: {
      vehicleId: z.string().optional().describe('Limit to a specific vehicle'),
      startDate: z.string().optional().describe('Start date (ISO 8601, e.g. 2025-01-01)'),
      endDate: z.string().optional().describe('End date (ISO 8601, e.g. 2025-12-31)'),
    },
  }, async ({ vehicleId, startDate, endDate }) => {
    const db = getAdminDb();
    const [logs, profileDoc] = await Promise.all([
      fetchLogs(userId, { vehicleId, startDate, endDate }),
      db.collection('userProfiles').doc(userId).get(),
    ]);
    const homeCurrency = profileDoc.exists ? (profileDoc.data()?.homeCurrency ?? 'EUR') : 'EUR';

    if (logs.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No logs found for the specified filters.' }] };
    }

    const totalSpent = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
    const totalLiters = logs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
    const totalKm = logs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);

    const result = {
      logCount: logs.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      homeCurrency,
      totalFuelLiters: Math.round(totalLiters * 100) / 100,
      totalDistanceKm: Math.round(totalKm * 100) / 100,
      efficiency: {
        kml: calcKmL(totalKm, totalLiters),
        l100km: calcL100km(totalKm, totalLiters),
        mpgUK: calcMPG(totalKm, totalLiters),
      },
      avgCostPerLiter: calcFuelPrice(totalSpent, totalLiters),
      avgCostPerKm: totalKm > 0 ? Math.round((totalSpent / totalKm) * 10000) / 10000 : null,
      filters: { vehicleId: vehicleId ?? null, startDate: startDate ?? null, endDate: endDate ?? null },
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.registerTool('compare_vehicles', {
    description: 'Compare fuel efficiency and costs across multiple vehicles.',
    inputSchema: {
      vehicleIds: z.array(z.string()).optional().describe('Specific vehicle IDs to compare (defaults to all vehicles)'),
      startDate: z.string().optional().describe('Start date for comparison period'),
      endDate: z.string().optional().describe('End date for comparison period'),
    },
  }, async ({ vehicleIds, startDate, endDate }) => {
    const db = getAdminDb();
    const [allLogs, vehiclesSnapshot] = await Promise.all([
      fetchLogs(userId, { startDate, endDate }),
      db.collection('vehicles').where('userId', '==', userId).get(),
    ]);

    const vehicleMap = new Map<string, string>();
    vehiclesSnapshot.docs.forEach(d => vehicleMap.set(d.id, d.data().name ?? d.id));

    const filteredLogs = vehicleIds
      ? allLogs.filter(l => l.vehicleId && vehicleIds.includes(l.vehicleId))
      : allLogs;

    const byVehicle = new Map<string, ServerLog[]>();
    for (const log of filteredLogs) {
      const vid = log.vehicleId ?? '__unknown__';
      if (!byVehicle.has(vid)) byVehicle.set(vid, []);
      byVehicle.get(vid)!.push(log);
    }

    const comparison = [...byVehicle.entries()].map(([vehicleId, logs]) => {
      const totalSpent = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
      const totalLiters = logs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
      const totalKm = logs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);
      return {
        vehicleId,
        vehicleName: vehicleMap.get(vehicleId) ?? (vehicleId === '__unknown__' ? 'No vehicle' : vehicleId),
        logCount: logs.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalKm: Math.round(totalKm * 100) / 100,
        kml: calcKmL(totalKm, totalLiters),
        mpgUK: calcMPG(totalKm, totalLiters),
        l100km: calcL100km(totalKm, totalLiters),
        avgCostPerLiter: calcFuelPrice(totalSpent, totalLiters),
      };
    });

    return { content: [{ type: 'text' as const, text: JSON.stringify(comparison, null, 2) }] };
  });
}

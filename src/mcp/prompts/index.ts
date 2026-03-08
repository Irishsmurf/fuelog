import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin.js';
import { calcKmL, calcFuelPrice } from '../calculations.js';
import type { ServerLog } from '../types.js';

async function fetchLogs(userId: string, opts: { vehicleId?: string; startDate?: string; endDate?: string; limit?: number } = {}): Promise<ServerLog[]> {
  const db = getAdminDb();
  let q = db.collection('fuelLogs')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(opts.limit ?? 500) as FirebaseFirestore.Query;
  if (opts.vehicleId) q = q.where('vehicleId', '==', opts.vehicleId);
  if (opts.startDate) q = q.where('timestamp', '>=', Timestamp.fromDate(new Date(opts.startDate)));
  if (opts.endDate) q = q.where('timestamp', '<=', Timestamp.fromDate(new Date(opts.endDate + 'T23:59:59Z')));
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServerLog));
}

async function getHomeCurrency(userId: string): Promise<string> {
  const db = getAdminDb();
  const doc = await db.collection('userProfiles').doc(userId).get();
  return doc.exists ? (doc.data()?.homeCurrency ?? 'EUR') : 'EUR';
}

function logsToSummaryText(logs: ServerLog[], currency: string): string {
  if (logs.length === 0) return 'No fuel logs found for this period.';
  const totalSpent = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
  const totalLiters = logs.reduce((s, l) => s + (l.fuelAmountLiters ?? 0), 0);
  const totalKm = logs.reduce((s, l) => s + (l.distanceKm ?? 0), 0);
  const kml = calcKmL(totalKm, totalLiters);
  const cpl = calcFuelPrice(totalSpent, totalLiters);
  const entries = logs.map(l => ({
    date: l.timestamp?.toDate?.()?.toISOString()?.slice(0, 10),
    brand: l.brand,
    cost: `${l.cost} ${currency}`,
    distanceKm: l.distanceKm,
    fuelAmountLiters: l.fuelAmountLiters,
    vehicleId: l.vehicleId ?? null,
  }));
  return JSON.stringify({ summary: { totalLogs: logs.length, totalSpent: `${totalSpent.toFixed(2)} ${currency}`, totalFuelLiters: totalLiters.toFixed(2), totalDistanceKm: totalKm.toFixed(2), avgEfficiencyKml: kml?.toFixed(2) ?? 'N/A', avgCostPerLiter: cpl?.toFixed(3) ?? 'N/A' }, entries }, null, 2);
}

export function registerPrompts(server: McpServer, userId: string) {
  server.registerPrompt('monthly_report', {
    title: 'Monthly Fuel Report',
    description: 'Generate a detailed monthly fuel consumption report with trends and insights.',
    argsSchema: {
      month: z.string().describe('Month in YYYY-MM format (e.g. 2025-03)'),
      vehicleId: z.string().optional().describe('Limit to a specific vehicle ID'),
    },
  }, async ({ month, vehicleId }) => {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const lastDay = new Date(Number(year), Number(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${lastDay}`;
    const [logs, currency] = await Promise.all([
      fetchLogs(userId, { vehicleId, startDate, endDate }),
      getHomeCurrency(userId),
    ]);
    const dataText = logsToSummaryText(logs, currency);
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Here is my fuel log data for ${month}:\n\n${dataText}\n\nPlease generate a detailed monthly fuel report including: total spend, total distance, fuel efficiency, cost per litre trends, notable fills, and any observations or recommendations.`,
          },
        },
      ],
    };
  });

  server.registerPrompt('trend_analysis', {
    title: 'Fuel Efficiency Trend Analysis',
    description: 'Analyse fuel efficiency and cost trends over a time period.',
    argsSchema: {
      startDate: z.string().describe('Start date (ISO 8601, e.g. 2025-01-01)'),
      endDate: z.string().describe('End date (ISO 8601, e.g. 2025-12-31)'),
      metric: z.enum(['kml', 'mpg', 'l100km', 'cost']).optional().describe('Primary metric to focus on'),
      vehicleId: z.string().optional().describe('Limit to a specific vehicle'),
    },
  }, async ({ startDate, endDate, metric = 'kml', vehicleId }) => {
    const [logs, currency] = await Promise.all([
      fetchLogs(userId, { vehicleId, startDate, endDate }),
      getHomeCurrency(userId),
    ]);
    const dataText = logsToSummaryText(logs, currency);
    const metricLabel = { kml: 'km/L efficiency', mpg: 'MPG (UK)', l100km: 'L/100km consumption', cost: 'fuel cost per litre' }[metric];
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Here is my fuel log data from ${startDate} to ${endDate}:\n\n${dataText}\n\nPlease analyse trends in my ${metricLabel}. Identify improvements or deteriorations over time, seasonal patterns if visible, and provide specific recommendations to improve efficiency.`,
          },
        },
      ],
    };
  });

  server.registerPrompt('cost_optimization', {
    title: 'Fuel Cost Optimisation',
    description: 'Identify patterns and suggest ways to reduce fuel costs.',
    argsSchema: {
      period: z.enum(['last_month', 'last_quarter', 'last_year']).optional().describe('Time period to analyse'),
    },
  }, async ({ period = 'last_quarter' }) => {
    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);
    let startDate: string;
    if (period === 'last_month') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === 'last_year') {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
      startDate = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      startDate = d.toISOString().slice(0, 10);
    }

    const db = getAdminDb();
    const [logs, currency, vehiclesSnapshot] = await Promise.all([
      fetchLogs(userId, { startDate, endDate }),
      getHomeCurrency(userId),
      db.collection('vehicles').where('userId', '==', userId).get(),
    ]);
    const vehicleMap = new Map<string, string>();
    vehiclesSnapshot.docs.forEach(d => vehicleMap.set(d.id, d.data().name ?? d.id));

    const enrichedLogs = logs.map(l => ({
      date: l.timestamp?.toDate?.()?.toISOString()?.slice(0, 10),
      brand: l.brand,
      cost: l.cost,
      costPerLiter: l.fuelAmountLiters > 0 ? Math.round((l.cost / l.fuelAmountLiters) * 1000) / 1000 : null,
      distanceKm: l.distanceKm,
      fuelAmountLiters: l.fuelAmountLiters,
      vehicle: l.vehicleId ? (vehicleMap.get(l.vehicleId) ?? l.vehicleId) : null,
    }));

    const dataText = JSON.stringify({ period, currency, entries: enrichedLogs }, null, 2);
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Here is my fuel log data for the ${period.replace('_', ' ')}:\n\n${dataText}\n\nPlease analyse my fuel spending patterns and identify opportunities to save money. Consider: most expensive fill stations, cost per litre trends, fill frequency, any correlation between driving patterns and costs, and provide actionable recommendations.`,
          },
        },
      ],
    };
  });
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin.js';
import type { TokenIdentity } from '../auth.js';
import { hasScope } from '../auth.js';
import type { ServerLog } from '../types.js';

const UNAUTHORIZED = { content: [{ type: 'text' as const, text: 'Error: token does not have the required scope.' }], isError: true };

export function registerFuelLogTools(server: McpServer, userId: string, identity: TokenIdentity) {
  server.registerTool('list_logs', {
    description: 'List fuel log entries with optional filters. Returns up to 100 entries by default.',
    inputSchema: {
      limit: z.number().min(1).max(500).optional().describe('Max entries to return (default 100)'),
      vehicleId: z.string().optional().describe('Filter by vehicle ID'),
      startDate: z.string().optional().describe('Filter from this date (ISO 8601, e.g. 2025-01-01)'),
      endDate: z.string().optional().describe('Filter to this date (ISO 8601, e.g. 2025-12-31)'),
      brand: z.string().optional().describe('Filter by fuel station brand (case-insensitive partial match)'),
    },
  }, async ({ limit = 100, vehicleId, startDate, endDate, brand }) => {
    const db = getAdminDb();
    let q = db.collection('fuelLogs')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit) as FirebaseFirestore.Query;

    if (vehicleId) q = q.where('vehicleId', '==', vehicleId);
    if (startDate) q = q.where('timestamp', '>=', Timestamp.fromDate(new Date(startDate)));
    if (endDate) q = q.where('timestamp', '<=', Timestamp.fromDate(new Date(endDate + 'T23:59:59Z')));

    const snapshot = await q.get();
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerLog & { id: string }));
    if (brand) logs = logs.filter(l => l.brand?.toLowerCase().includes(brand.toLowerCase()));

    return { content: [{ type: 'text' as const, text: JSON.stringify(logs.map(l => ({ ...l, timestamp: l.timestamp?.toDate?.()?.toISOString() })), null, 2) }] };
  });

  server.registerTool('log_fuel', {
    description: 'Create a new fuel log entry. Costs should be in the user\'s home currency.',
    inputSchema: {
      brand: z.string().describe('Fuel station / brand name'),
      cost: z.number().positive().describe('Cost in home currency'),
      distanceKm: z.number().positive().describe('Distance driven since last fill-up in kilometres'),
      fuelAmountLiters: z.number().positive().describe('Fuel amount added in litres'),
      currency: z.string().optional().describe('Transaction currency code if different from home currency (e.g. GBP)'),
      originalCost: z.number().positive().optional().describe('Cost in transaction currency (if currency differs from home)'),
      exchangeRate: z.number().positive().optional().describe('Exchange rate: 1 transaction currency = X home currency'),
      vehicleId: z.string().optional().describe('Vehicle ID to associate this log with'),
      timestamp: z.string().optional().describe('ISO 8601 datetime for the entry (defaults to now)'),
      latitude: z.number().optional().describe('GPS latitude'),
      longitude: z.number().optional().describe('GPS longitude'),
    },
  }, async (args) => {
    if (!hasScope(identity, 'write:logs')) return UNAUTHORIZED;
    const db = getAdminDb();
    const ts = args.timestamp ? Timestamp.fromDate(new Date(args.timestamp)) : Timestamp.now();
    const data = {
      userId,
      timestamp: ts,
      brand: args.brand,
      cost: args.cost,
      distanceKm: args.distanceKm,
      fuelAmountLiters: args.fuelAmountLiters,
      ...(args.currency && { currency: args.currency }),
      ...(args.originalCost && { originalCost: args.originalCost }),
      ...(args.exchangeRate && { exchangeRate: args.exchangeRate }),
      ...(args.vehicleId && { vehicleId: args.vehicleId }),
      ...(args.latitude !== undefined && { latitude: args.latitude }),
      ...(args.longitude !== undefined && { longitude: args.longitude }),
    };
    const ref = await db.collection('fuelLogs').add(data);
    return { content: [{ type: 'text' as const, text: `Fuel log created with ID: ${ref.id}` }] };
  });

  server.registerTool('edit_fuel_log', {
    description: 'Update fields of an existing fuel log entry.',
    inputSchema: {
      logId: z.string().describe('The ID of the log entry to update'),
      brand: z.string().optional(),
      cost: z.number().positive().optional(),
      distanceKm: z.number().positive().optional(),
      fuelAmountLiters: z.number().positive().optional(),
      currency: z.string().optional(),
      originalCost: z.number().positive().optional(),
      exchangeRate: z.number().positive().optional(),
      vehicleId: z.string().optional(),
    },
  }, async ({ logId, ...updates }) => {
    if (!hasScope(identity, 'write:logs')) return UNAUTHORIZED;
    const db = getAdminDb();
    const docRef = db.collection('fuelLogs').doc(logId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      return { content: [{ type: 'text' as const, text: `Error: log ${logId} not found.` }], isError: true };
    }
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    await docRef.update(filtered);
    return { content: [{ type: 'text' as const, text: `Log ${logId} updated successfully.` }] };
  });

  server.registerTool('delete_fuel_log', {
    description: 'Permanently delete a fuel log entry. This cannot be undone.',
    inputSchema: {
      logId: z.string().describe('The ID of the log entry to delete'),
      confirm: z.literal(true).describe('Must be true to confirm deletion'),
    },
  }, async ({ logId }) => {
    if (!hasScope(identity, 'write:logs')) return UNAUTHORIZED;
    const db = getAdminDb();
    const docRef = db.collection('fuelLogs').doc(logId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      return { content: [{ type: 'text' as const, text: `Error: log ${logId} not found.` }], isError: true };
    }
    await docRef.delete();
    return { content: [{ type: 'text' as const, text: `Log ${logId} deleted successfully.` }] };
  });
}

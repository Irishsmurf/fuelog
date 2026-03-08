import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAdminDb } from '../firebase-admin.js';
import type { ServerLog } from '../types.js';

function logToJson(log: ServerLog) {
  return {
    id: log.id,
    timestamp: log.timestamp?.toDate?.()?.toISOString() ?? null,
    brand: log.brand,
    cost: log.cost,
    distanceKm: log.distanceKm,
    fuelAmountLiters: log.fuelAmountLiters,
    currency: log.currency ?? null,
    originalCost: log.originalCost ?? null,
    exchangeRate: log.exchangeRate ?? null,
    vehicleId: log.vehicleId ?? null,
    latitude: log.latitude ?? null,
    longitude: log.longitude ?? null,
    receiptUrl: log.receiptUrl ?? null,
  };
}

export function registerLogResources(server: McpServer, userId: string) {
  // List all logs
  server.registerResource(
    'fuel-logs',
    'fuelog://logs',
    { description: 'All fuel log entries for this user, newest first (up to 200)', mimeType: 'application/json' },
    async () => {
      const db = getAdminDb();
      const snapshot = await db
        .collection('fuelLogs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();
      const logs = snapshot.docs.map(doc => logToJson({ id: doc.id, ...doc.data() } as ServerLog));
      return { contents: [{ uri: 'fuelog://logs', mimeType: 'application/json', text: JSON.stringify(logs, null, 2) }] };
    }
  );

  // Single log by ID
  server.registerResource(
    'fuel-log',
    new ResourceTemplate('fuelog://logs/{id}', { list: undefined }),
    { description: 'A single fuel log entry by ID', mimeType: 'application/json' },
    async (uri, { id }) => {
      const db = getAdminDb();
      const doc = await db.collection('fuelLogs').doc(id as string).get();
      if (!doc.exists || doc.data()?.userId !== userId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      const log = logToJson({ id: doc.id, ...doc.data() } as ServerLog);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(log, null, 2) }] };
    }
  );
}

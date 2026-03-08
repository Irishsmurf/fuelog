import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAdminDb } from '../firebase-admin.js';
import type { ServerVehicle } from '../types.js';

export function registerVehicleResources(server: McpServer, userId: string) {
  server.registerResource(
    'vehicles',
    'fuelog://vehicles',
    { description: 'All vehicles registered by this user', mimeType: 'application/json' },
    async () => {
      const db = getAdminDb();
      const snapshot = await db
        .collection('vehicles')
        .where('userId', '==', userId)
        .get();
      const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerVehicle));
      return { contents: [{ uri: 'fuelog://vehicles', mimeType: 'application/json', text: JSON.stringify(vehicles, null, 2) }] };
    }
  );

  server.registerResource(
    'vehicle',
    new ResourceTemplate('fuelog://vehicles/{id}', { list: undefined }),
    { description: 'A single vehicle by ID', mimeType: 'application/json' },
    async (uri, { id }) => {
      const db = getAdminDb();
      const doc = await db.collection('vehicles').doc(id as string).get();
      if (!doc.exists || doc.data()?.userId !== userId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      const vehicle = { id: doc.id, ...doc.data() } as ServerVehicle;
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(vehicle, null, 2) }] };
    }
  );
}

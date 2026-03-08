import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAdminDb } from '../firebase-admin.js';

export function registerProfileResource(server: McpServer, userId: string) {
  server.registerResource(
    'profile',
    'fuelog://profile',
    { description: 'User profile: home currency and account info', mimeType: 'application/json' },
    async () => {
      const db = getAdminDb();
      const doc = await db.collection('userProfiles').doc(userId).get();
      const profile = {
        userId,
        homeCurrency: doc.exists ? (doc.data()?.homeCurrency ?? 'EUR') : 'EUR',
      };
      return { contents: [{ uri: 'fuelog://profile', mimeType: 'application/json', text: JSON.stringify(profile, null, 2) }] };
    }
  );
}

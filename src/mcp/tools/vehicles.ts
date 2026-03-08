import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAdminDb } from '../firebase-admin.js';
import type { TokenIdentity } from '../auth.js';
import { hasScope } from '../auth.js';
import type { ServerVehicle } from '../types.js';

const UNAUTHORIZED = { content: [{ type: 'text' as const, text: 'Error: token does not have the required scope.' }], isError: true };

export function registerVehicleTools(server: McpServer, userId: string, identity: TokenIdentity) {
  server.registerTool('list_vehicles', {
    description: 'List all vehicles for this user.',
    inputSchema: {
      includeArchived: z.boolean().optional().describe('Include archived vehicles (default false)'),
    },
  }, async ({ includeArchived = false }) => {
    const db = getAdminDb();
    const snapshot = await db.collection('vehicles').where('userId', '==', userId).get();
    let vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerVehicle));
    if (!includeArchived) vehicles = vehicles.filter(v => !v.isArchived);
    return { content: [{ type: 'text' as const, text: JSON.stringify(vehicles, null, 2) }] };
  });

  server.registerTool('add_vehicle', {
    description: 'Register a new vehicle for this user.',
    inputSchema: {
      name: z.string().describe('Nickname for the vehicle (e.g. "Daily Driver")'),
      make: z.string().describe('Vehicle make / manufacturer (e.g. "Toyota")'),
      model: z.string().describe('Vehicle model (e.g. "Corolla")'),
      year: z.string().describe('Model year (e.g. "2022")'),
      fuelType: z.enum(['Petrol', 'Diesel', 'Hybrid', 'Electric']).describe('Fuel type'),
      isDefault: z.boolean().optional().describe('Set as the default vehicle'),
    },
  }, async ({ name, make, model, year, fuelType, isDefault = false }) => {
    if (!hasScope(identity, 'write:vehicles')) return UNAUTHORIZED;
    const db = getAdminDb();

    // If setting as default, unset existing defaults
    if (isDefault) {
      const existingSnapshot = await db.collection('vehicles')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = db.batch();
      existingSnapshot.docs.forEach(d => batch.update(d.ref, { isDefault: false }));
      await batch.commit();
    }

    const ref = await db.collection('vehicles').add({ userId, name, make, model, year, fuelType, isDefault, isArchived: false });
    return { content: [{ type: 'text' as const, text: `Vehicle created with ID: ${ref.id}` }] };
  });

  server.registerTool('update_vehicle', {
    description: 'Update an existing vehicle\'s details, or archive/unarchive it.',
    inputSchema: {
      vehicleId: z.string().describe('The ID of the vehicle to update'),
      name: z.string().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.string().optional(),
      fuelType: z.enum(['Petrol', 'Diesel', 'Hybrid', 'Electric']).optional(),
      isDefault: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    },
  }, async ({ vehicleId, ...updates }) => {
    if (!hasScope(identity, 'write:vehicles')) return UNAUTHORIZED;
    const db = getAdminDb();
    const docRef = db.collection('vehicles').doc(vehicleId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      return { content: [{ type: 'text' as const, text: `Error: vehicle ${vehicleId} not found.` }], isError: true };
    }

    // If setting as default, unset existing defaults first
    if (updates.isDefault) {
      const existingSnapshot = await db.collection('vehicles')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = db.batch();
      existingSnapshot.docs.forEach(d => { if (d.id !== vehicleId) batch.update(d.ref, { isDefault: false }); });
      await batch.commit();
    }

    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    await docRef.update(filtered);
    return { content: [{ type: 'text' as const, text: `Vehicle ${vehicleId} updated successfully.` }] };
  });
}

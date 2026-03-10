import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { validateToken, hasScope } from '../src/mcp/auth.js';
import { getAdminDb } from '../src/mcp/firebase-admin.js';
import { Timestamp, AggregateField } from 'firebase-admin/firestore';
import { log } from './_logger.js';
import { calcMPG, calcKmL, calcL100km, calcFuelPrice } from '../src/mcp/calculations.js';
import type { ServerLog, ServerVehicle } from '../src/mcp/types.js';

function extractBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

/**
 * Reads the request body stream and parses it as JSON.
 * @param req The incoming HTTP request.
 * @returns A promise that resolves to the parsed JSON object, or throws an error on invalid JSON.
 */
async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';

    // Explicitly handle string conversion on incoming chunks
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendResponse(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://fuel.paddez.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // CORS handled, exit early
  }
  return false;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const startMs = Date.now();
  if (handleCors(req, res)) return;

  // Authenticate
  const rawToken = extractBearerToken(req);
  if (!rawToken) {
    return sendResponse(res, 401, { error: 'Missing Authorization: Bearer <token> header' });
  }

  const identity = await validateToken(rawToken);
  if (!identity) {
    return sendResponse(res, 401, { error: 'Invalid or revoked token' });
  }

  try {
    const host = req.headers.host || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    const type = url.searchParams.get('type') || '';
    const id = url.searchParams.get('id') || '';

    const db = getAdminDb();
    const userId = identity.userId;

    if (type === 'logs') {
      if (req.method === 'GET') {
        let limit = Number(url.searchParams.get('limit'));
        if (isNaN(limit) || limit <= 0) limit = 100;

        const q = db.collection('fuelLogs').where('userId', '==', userId).orderBy('timestamp', 'desc').limit(limit);
        const snapshot = await q.get();
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, timestamp: data.timestamp?.toDate?.()?.toISOString() } as ServerLog & { id: string };
        });
        return sendResponse(res, 200, { logs });
      }

      if (!hasScope(identity, 'write:logs')) {
         return sendResponse(res, 403, { error: 'Missing write:logs scope' });
      }

      if (req.method === 'POST') {
        let body;
        try {
          body = await readBody(req);
        } catch (e: unknown) {
          return sendResponse(res, 400, { error: (e as Error).message });
        }
        if (body.brand === undefined || body.cost === undefined || body.distanceKm === undefined || body.fuelAmountLiters === undefined) {
            return sendResponse(res, 400, { error: 'Missing required fields' });
        }
        const ts = body.timestamp ? Timestamp.fromDate(new Date(body.timestamp)) : Timestamp.now();
        const data = {
          userId,
          timestamp: ts,
          brand: body.brand,
          cost: body.cost,
          distanceKm: body.distanceKm,
          fuelAmountLiters: body.fuelAmountLiters,
          ...(body.currency && { currency: body.currency }),
          ...(body.originalCost && { originalCost: body.originalCost }),
          ...(body.exchangeRate && { exchangeRate: body.exchangeRate }),
          ...(body.vehicleId && { vehicleId: body.vehicleId }),
          ...(body.latitude !== undefined && { latitude: body.latitude }),
          ...(body.longitude !== undefined && { longitude: body.longitude }),
        };
        const ref = await db.collection('fuelLogs').add(data);
        return sendResponse(res, 201, { id: ref.id });
      }

      if (req.method === 'PUT') {
        if (!id) return sendResponse(res, 400, { error: 'Missing id parameter' });
        let body;
        try {
          body = await readBody(req);
        } catch (e: unknown) {
          return sendResponse(res, 400, { error: (e as Error).message });
        }
        const docRef = db.collection('fuelLogs').doc(id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data()?.userId !== userId) {
          return sendResponse(res, 404, { error: 'Log not found' });
        }
        // Exclude internal fields
        const { timestamp, ...updates } = body;
        delete updates.userId;
        delete updates.id;
        if (timestamp) updates.timestamp = Timestamp.fromDate(new Date(timestamp));

        await docRef.update(updates);
        return sendResponse(res, 200, { success: true });
      }

      if (req.method === 'DELETE') {
         if (!id) return sendResponse(res, 400, { error: 'Missing id parameter' });
         const docRef = db.collection('fuelLogs').doc(id);
         const doc = await docRef.get();
         if (!doc.exists || doc.data()?.userId !== userId) {
           return sendResponse(res, 404, { error: 'Log not found' });
         }
         await docRef.delete();
         return sendResponse(res, 200, { success: true });
      }
    } else if (type === 'vehicles') {
       if (req.method === 'GET') {
          const includeArchived = url.searchParams.get('includeArchived') === 'true';
          const snapshot = await db.collection('vehicles').where('userId', '==', userId).get();
          let vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServerVehicle));
          if (!includeArchived) vehicles = vehicles.filter(v => !v.isArchived);
          return sendResponse(res, 200, { vehicles });
       }

       if (!hasScope(identity, 'write:vehicles')) {
           return sendResponse(res, 403, { error: 'Missing write:vehicles scope' });
       }

       if (req.method === 'POST') {
           let body;
           try {
             body = await readBody(req);
           } catch (e: unknown) {
             return sendResponse(res, 400, { error: (e as Error).message });
           }
           if (!body.name || !body.make || !body.model || !body.year || !body.fuelType) {
               return sendResponse(res, 400, { error: 'Missing required fields' });
           }
           const isDefault = !!body.isDefault;
           if (isDefault) {
             const existingSnapshot = await db.collection('vehicles')
               .where('userId', '==', userId)
               .where('isDefault', '==', true)
               .get();
             const batch = db.batch();
             existingSnapshot.docs.forEach(d => batch.update(d.ref, { isDefault: false }));
             await batch.commit();
           }
           const ref = await db.collection('vehicles').add({
              userId,
              name: body.name,
              make: body.make,
              model: body.model,
              year: body.year,
              fuelType: body.fuelType,
              isDefault,
              isArchived: false
           });
           return sendResponse(res, 201, { id: ref.id });
       }

       if (req.method === 'PUT') {
           if (!id) return sendResponse(res, 400, { error: 'Missing id parameter' });
           let body;
           try {
             body = await readBody(req);
           } catch (e: unknown) {
             return sendResponse(res, 400, { error: (e as Error).message });
           }
           const docRef = db.collection('vehicles').doc(id);
           const doc = await docRef.get();
           if (!doc.exists || doc.data()?.userId !== userId) {
             return sendResponse(res, 404, { error: 'Vehicle not found' });
           }
           if (body.isDefault) {
             const existingSnapshot = await db.collection('vehicles')
               .where('userId', '==', userId)
               .where('isDefault', '==', true)
               .get();
             const batch = db.batch();
             existingSnapshot.docs.forEach(d => { if (d.id !== id) batch.update(d.ref, { isDefault: false }); });
             await batch.commit();
           }
           const { ...updates } = body;
           delete updates.userId;
           delete updates.id;
           await docRef.update(updates);
           return sendResponse(res, 200, { success: true });
       }

       if (req.method === 'DELETE') {
           if (!id) return sendResponse(res, 400, { error: 'Missing id parameter' });
           const docRef = db.collection('vehicles').doc(id);
           const doc = await docRef.get();
           if (!doc.exists || doc.data()?.userId !== userId) {
             return sendResponse(res, 404, { error: 'Vehicle not found' });
           }
           await docRef.delete();
           return sendResponse(res, 200, { success: true });
       }
    } else if (type === 'analytics') {
       if (req.method === 'GET') {
          const vehicleId = url.searchParams.get('vehicleId');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');

          let q = db.collection('fuelLogs').where('userId', '==', userId) as FirebaseFirestore.Query;
          if (vehicleId) q = q.where('vehicleId', '==', vehicleId);
          if (startDate) q = q.where('timestamp', '>=', Timestamp.fromDate(new Date(startDate)));
          if (endDate) q = q.where('timestamp', '<=', Timestamp.fromDate(new Date(endDate + 'T23:59:59Z')));

          const [aggSnap, profileDoc] = await Promise.all([
             q.aggregate({
               totalSpent: AggregateField.sum('cost'),
               totalLiters: AggregateField.sum('fuelAmountLiters'),
               totalKm: AggregateField.sum('distanceKm'),
               logCount: AggregateField.count(),
             }).get(),
             db.collection('userProfiles').doc(userId).get()
          ]);

          const aggData = aggSnap.data();
          const homeCurrency = profileDoc.exists ? (profileDoc.data()?.homeCurrency ?? 'EUR') : 'EUR';

          const totalSpent = aggData.totalSpent ?? 0;
          const totalLiters = aggData.totalLiters ?? 0;
          const totalKm = aggData.totalKm ?? 0;
          const logCount = aggData.logCount ?? 0;

          const result = {
            logCount,
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

          return sendResponse(res, 200, result);
       }
    }

    return sendResponse(res, 400, { error: 'Invalid or missing type parameter' });
  } catch (err) {
    log('error', 'rest', 'Handler error', { message: (err as Error).message, method: req.method, url: req.url, durationMs: Date.now() - startMs });
    if (!res.headersSent) {
      return sendResponse(res, 500, { error: 'Internal server error' });
    }
  }
}

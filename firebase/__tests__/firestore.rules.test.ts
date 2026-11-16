import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, increment,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const ALICE = 'alice';
const BOB = 'bob';
const HASH = 'a'.repeat(64);

let env: RulesTestEnvironment;

const asUser = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

/** Seed documents bypassing the rules. */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const validLog = (userId: string) => ({
  userId,
  vehicleId: 'v1',
  timestamp: Timestamp.now(),
  brand: 'Circle K',
  cost: 60,
  distanceKm: 500,
  fuelAmountLiters: 40,
});

const validToken = (userId: string) => ({
  userId,
  name: 'laptop',
  tokenHash: HASH,
  tokenPrefix: 'flog_abcd',
  scopes: ['read:logs'],
  createdAt: Timestamp.now(),
  lastUsedAt: null,
  isRevoked: false,
  expiresAt: null,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fuelog-rules',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('apiTokens', () => {
  it('lets a user create a well-formed token for themselves', async () => {
    await assertSucceeds(setDoc(doc(asUser(ALICE), 'apiTokens/t1'), validToken(ALICE)));
  });

  it('rejects creating a token for someone else', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'apiTokens/t1'), validToken(BOB)));
  });

  it('rejects unknown scopes on create', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'apiTokens/t1'), {
      ...validToken(ALICE), scopes: ['read:logs', 'admin'],
    }));
  });

  it('rejects creating an already-revoked or malformed token', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'apiTokens/t1'), { ...validToken(ALICE), tokenHash: 'short' }));
    await assertFails(setDoc(doc(asUser(ALICE), 'apiTokens/t2'), { ...validToken(ALICE), isRevoked: true }));
  });

  it('blocks re-assigning a token to another user (account takeover)', async () => {
    await seed('apiTokens/t1', validToken(ALICE));
    await assertFails(updateDoc(doc(asUser(ALICE), 'apiTokens/t1'), { userId: BOB }));
  });

  it('blocks widening scopes, swapping the hash, or un-revoking', async () => {
    await seed('apiTokens/t1', validToken(ALICE));
    await seed('apiTokens/t2', { ...validToken(ALICE), isRevoked: true });
    const db = asUser(ALICE);
    await assertFails(updateDoc(doc(db, 'apiTokens/t1'), { scopes: ['read:logs', 'write:logs'] }));
    await assertFails(updateDoc(doc(db, 'apiTokens/t1'), { tokenHash: 'b'.repeat(64) }));
    await assertFails(updateDoc(doc(db, 'apiTokens/t1'), { expiresAt: null, isRevoked: true, name: 'x' }));
    await assertFails(updateDoc(doc(db, 'apiTokens/t2'), { isRevoked: false }));
  });

  it('allows the owner to revoke', async () => {
    await seed('apiTokens/t1', validToken(ALICE));
    await assertSucceeds(updateDoc(doc(asUser(ALICE), 'apiTokens/t1'), { isRevoked: true }));
  });

  it("hides and protects other users' tokens", async () => {
    await seed('apiTokens/t1', validToken(ALICE));
    const db = asUser(BOB);
    await assertFails(getDoc(doc(db, 'apiTokens/t1')));
    await assertFails(updateDoc(doc(db, 'apiTokens/t1'), { isRevoked: true }));
    await assertFails(deleteDoc(doc(db, 'apiTokens/t1')));
  });
});

describe('fuelLogs', () => {
  it('lets a user create, read, edit and delete their own log', async () => {
    const db = asUser(ALICE);
    await assertSucceeds(setDoc(doc(db, 'fuelLogs/l1'), validLog(ALICE)));
    await assertSucceeds(getDoc(doc(db, 'fuelLogs/l1')));
    await assertSucceeds(updateDoc(doc(db, 'fuelLogs/l1'), { cost: 65, odometerKm: 12000 }));
    await assertSucceeds(deleteDoc(doc(db, 'fuelLogs/l1')));
  });

  it('rejects creating a log for another user', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'fuelLogs/l1'), validLog(BOB)));
  });

  it('blocks moving a log into another account', async () => {
    await seed('fuelLogs/l1', validLog(ALICE));
    await assertFails(updateDoc(doc(asUser(ALICE), 'fuelLogs/l1'), { userId: BOB }));
  });

  it('rejects wrongly-typed or missing core fields', async () => {
    const db = asUser(ALICE);
    await assertFails(setDoc(doc(db, 'fuelLogs/l1'), { ...validLog(ALICE), cost: '60' }));
    const noDistance: Partial<ReturnType<typeof validLog>> = validLog(ALICE);
    delete noDistance.distanceKm;
    await assertFails(setDoc(doc(db, 'fuelLogs/l2'), noDistance));
    await assertFails(setDoc(doc(db, 'fuelLogs/l3'), { ...validLog(ALICE), timestamp: '2026-01-01' }));
    await seed('fuelLogs/l4', validLog(ALICE));
    await assertFails(updateDoc(doc(db, 'fuelLogs/l4'), { odometerKm: 'lots' }));
  });

  it('keeps legacy logs (missing optional fields) editable', async () => {
    await seed('fuelLogs/legacy', {
      userId: ALICE, timestamp: Timestamp.now(), brand: 'Esso', cost: 50, distanceKm: 400, fuelAmountLiters: 35,
    });
    await assertSucceeds(updateDoc(doc(asUser(ALICE), 'fuelLogs/legacy'), { stationId: 'node_123' }));
  });

  it("denies access to other users' logs and to anonymous users", async () => {
    await seed('fuelLogs/l1', validLog(ALICE));
    await assertFails(getDoc(doc(asUser(BOB), 'fuelLogs/l1')));
    await assertFails(updateDoc(doc(asUser(BOB), 'fuelLogs/l1'), { cost: 1 }));
    await assertFails(deleteDoc(doc(asUser(BOB), 'fuelLogs/l1')));
    await assertFails(getDoc(doc(anon(), 'fuelLogs/l1')));
  });
});

describe('vehicles', () => {
  const vehicle = (userId: string) => ({ userId, name: 'Corolla', make: 'Toyota', isDefault: true, isArchived: false });

  it('lets the owner manage their vehicle', async () => {
    const db = asUser(ALICE);
    await assertSucceeds(setDoc(doc(db, 'vehicles/v1'), vehicle(ALICE)));
    await assertSucceeds(updateDoc(doc(db, 'vehicles/v1'), { isDefault: false }));
  });

  it('blocks transferring a vehicle to another user', async () => {
    await seed('vehicles/v1', vehicle(ALICE));
    await assertFails(updateDoc(doc(asUser(ALICE), 'vehicles/v1'), { userId: BOB }));
  });

  it("denies access to other users' vehicles", async () => {
    await seed('vehicles/v1', vehicle(ALICE));
    await assertFails(getDoc(doc(asUser(BOB), 'vehicles/v1')));
    await assertFails(updateDoc(doc(asUser(BOB), 'vehicles/v1'), { name: 'mine' }));
  });
});

describe('stations', () => {
  const station = { osmId: 'node/1', name: 'Circle K', brand: 'Circle K', latitude: 53.3, longitude: -6.2, address: '', logCount: 0, avgPrice: 0 };

  it('allows creating a station with zeroed stats', async () => {
    await assertSucceeds(setDoc(doc(asUser(ALICE), 'stations/node_1'), station));
  });

  it('rejects creating a station with pre-seeded stats', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'stations/node_1'), { ...station, logCount: 50, avgPrice: 0.5 }));
  });

  it('accepts folding one price into the running average', async () => {
    await seed('stations/node_1', { ...station, logCount: 2, avgPrice: 1.7, lastPrice: 1.7 });
    const db = asUser(ALICE);
    // Mirrors updateStationMetrics in src/firebase/firestoreService.ts
    const newAvg = (1.7 * 2 + 1.8) / 3;
    await assertSucceeds(updateDoc(doc(db, 'stations/node_1'), { logCount: increment(1), avgPrice: newAvg, lastPrice: 1.8 }));
  });

  it('accepts the first price on a fresh station', async () => {
    await seed('stations/node_1', station);
    await assertSucceeds(updateDoc(doc(asUser(ALICE), 'stations/node_1'), { logCount: increment(1), avgPrice: 1.75, lastPrice: 1.75 }));
  });

  it('rejects arbitrary average or count overwrites', async () => {
    await seed('stations/node_1', { ...station, logCount: 2, avgPrice: 1.7, lastPrice: 1.7 });
    const db = asUser(BOB);
    await assertFails(updateDoc(doc(db, 'stations/node_1'), { logCount: 3, avgPrice: 0.01, lastPrice: 1.8 }));
    await assertFails(updateDoc(doc(db, 'stations/node_1'), { logCount: 1000, avgPrice: 1.7, lastPrice: 1.7 }));
    await assertFails(updateDoc(doc(db, 'stations/node_1'), { logCount: 3, avgPrice: (1.7 * 2 - 5) / 3, lastPrice: -5 }));
    await assertFails(updateDoc(doc(db, 'stations/node_1'), { name: 'Hijacked' }));
  });

  it('requires sign-in to read', async () => {
    await seed('stations/node_1', station);
    await assertFails(getDoc(doc(anon(), 'stations/node_1')));
    await assertSucceeds(getDoc(doc(asUser(BOB), 'stations/node_1')));
  });
});

describe('server-only collections', () => {
  it('denies all client access to budgetAlerts and testNotifications', async () => {
    const db = asUser(ALICE);
    await assertFails(setDoc(doc(db, `budgetAlerts/${ALICE}_2026-11`), { userId: ALICE }));
    await assertFails(getDoc(doc(db, `budgetAlerts/${ALICE}_2026-11`)));
    await assertFails(setDoc(doc(db, 'testNotifications/n1'), { userId: ALICE }));
  });
});

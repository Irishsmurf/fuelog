// Runs onLogWrite's handler and the derivedLogFields migration against the
// Firestore emulator, to check the real Admin SDK calls (select queries,
// transactions, create-if-absent, field deletes). Skipped unless
// FIRESTORE_EMULATOR_HOST is set, e.g. from the repo root:
//   npx -y firebase-tools@14.27.0 emulators:exec --only firestore --project demo-fuelog-fn \
//     'cd functions && npx vitest run src/__tests__/logDerived.emulator.test.ts'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { handleLogDerivedWrite, type DerivedLog, type Lookups } from '../logDerived';
import { migrateDerivedLogFields } from '../derivedLogFieldsMigration';

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
const DAY = 86_400_000;

describe.skipIf(!enabled)('onLogWrite against the Firestore emulator', () => {
    let db: Firestore;
    const lookups: Lookups = {
        findStation: vi.fn(async () => ({ id: 'node/42', osmId: 'node/42', name: 'Emu', latitude: 1, longitude: 2 })),
        fetchRate: vi.fn(async () => 1.25),
    };

    beforeAll(() => {
        if (getApps().length === 0) initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-fuelog-fn' });
        db = getFirestore();
    });

    beforeEach(async () => {
        for (const c of ['fuelLogs', 'stations', 'triggerEvents', 'userProfiles']) {
            const snap = await db.collection(c).get();
            await Promise.all(snap.docs.map((d) => d.ref.delete()));
        }
        await db.collection('userProfiles').doc('u1').set({ homeCurrency: 'EUR' });
    });

    const logData = (day: number, odometerKm: number | undefined, over: Record<string, unknown> = {}) => ({
        userId: 'u1', vehicleId: 'v1', timestamp: Timestamp.fromMillis(day * DAY), cost: 60, fuelAmountLiters: 40,
        distanceKm: 300, ...(odometerKm !== undefined && { odometerKm }), ...over,
    });

    /** Writes a log like a client, then runs the trigger handler for it. */
    async function write(id: string, data: Record<string, unknown> | null, eventId: string) {
        const ref = db.collection('fuelLogs').doc(id);
        const before = (await ref.get()).data() as DerivedLog | undefined;
        if (data) await ref.set(data); else await ref.delete();
        const after = data ? ((await ref.get()).data() as DerivedLog) : undefined;
        lastEvent = { id, before, after };
        return handleLogDerivedWrite(db, eventId, id, before, after, lookups);
    }
    let lastEvent: { id: string; before?: DerivedLog; after?: DerivedLog } = { id: '' };
    const get = async (id: string) => (await db.collection('fuelLogs').doc(id).get()).data()!;

    it('derives distances for an insert in the middle and a delete, and converges', async () => {
        await write('a', logData(1, 1000), 'e1');
        await write('c', logData(3, 1600), 'e2');
        expect((await get('c')).distanceKm).toBe(600);

        await write('b', logData(2, 1250, { latitude: 1, longitude: 2 }), 'e3');
        const e3 = lastEvent;
        expect(await get('b')).toMatchObject({ distanceKm: 250, stationId: 'node_42', kmPerLitre: 6.25, pricePerLitre: 1.5 });
        expect((await get('c')).distanceKm).toBe(350);
        expect((await db.collection('stations').doc('node_42').get()).data()).toMatchObject({ logCount: 0, avgPrice: 0 });

        // Its own write re-fires as a no-op.
        const b = await get('b') as DerivedLog;
        expect(await handleLogDerivedWrite(db, 'e4', 'b', { ...b, distanceKm: 1250 }, b, lookups)).toBe('skipped');
        // Redelivery of the original event is applied at most once.
        expect(await handleLogDerivedWrite(db, 'e3', 'b', e3.before, e3.after, lookups)).toBe('duplicate');

        await write('b', null, 'e5');
        expect(await get('c')).toMatchObject({ distanceKm: 600, kmPerLitre: 15 });
    });

    it('fills a missing home-currency cost and deletes values that no longer apply', async () => {
        const foreign: Record<string, unknown> = { ...logData(1, undefined), originalCost: 40, currency: 'GBP' };
        delete foreign.cost;
        await write('x', foreign, 'e1');
        expect(await get('x')).toMatchObject({ cost: 50, exchangeRate: 1.25, pricePerLitre: 1.25 });
        const x = await get('x');
        await write('x', { ...x, fuelAmountLiters: 0 }, 'e2');
        const after = await get('x');
        expect(after.pricePerLitre).toBeUndefined();
        expect(after.kmPerLitre).toBeUndefined();
    });

    it('migration: dry run writes nothing, apply backfills, re-run is a no-op', async () => {
        await db.collection('fuelLogs').doc('m1').set(logData(1, 1000));
        await db.collection('fuelLogs').doc('m2').set(logData(2, 1300, { distanceKm: 999 }));
        await db.collection('fuelLogs').doc('m3').set(logData(3, undefined, { distanceKm: 200, latitude: 1, longitude: 2 }));

        const dry = await migrateDerivedLogFields(db, { apply: false, lookups, sleep: async () => {} });
        expect(dry).toMatchObject({ odometerReconstructed: 1, distancesUpdated: 1, stationsAssigned: 1, logsWritten: 0 });
        expect((await get('m2')).distanceKm).toBe(999);

        const applied = await migrateDerivedLogFields(db, { apply: true, lookups, batchSize: 2, sleep: async () => {} });
        expect(applied.done).toBe(true);
        expect(await get('m2')).toMatchObject({ distanceKm: 300 });
        expect(await get('m3')).toMatchObject({ odometerKm: 1500, stationId: 'node_42' });

        const again = await migrateDerivedLogFields(db, { apply: true, lookups, sleep: async () => {} });
        expect(again.logsWritten).toBe(0);
    });
});

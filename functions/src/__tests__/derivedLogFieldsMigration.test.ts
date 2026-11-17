import { describe, it, expect, vi } from 'vitest';
import {
    migrateDerivedLogFields, packBatches, planPhaseOne, selectStationCandidates, type MigrationLog,
} from '../derivedLogFieldsMigration';
import { runPendingMigrations, type Migration } from '../migrations';
import type { Lookups } from '../logDerived';
import { fakeFirestore, ts, DAY } from './fakeFirestore';

const log = (id: string, day: number, over: Partial<MigrationLog> = {}): MigrationLog => ({
    id, userId: 'u1', vehicleId: 'v1', timestamp: ts(day * DAY), cost: 60, fuelAmountLiters: 40, distanceKm: 500, ...over,
});
const asDocs = (logs: MigrationLog[]) =>
    Object.fromEntries(logs.map(({ id, ...d }) => [`fuelLogs/${id}`, d as Record<string, unknown>]));
const station = (id: number) => ({ id: `node/${id}`, osmId: `node/${id}`, name: `S${id}`, latitude: 1, longitude: 1 });

describe('planPhaseOne', () => {
    it('reconstructs missing readings backwards and forwards from an anchor (backfillOdometer logic)', () => {
        const plan = planPhaseOne([
            log('a', 1, { distanceKm: 400 }),
            log('b', 2, { distanceKm: 300 }),
            log('c', 3, { distanceKm: 200, odometerKm: 10_000 }),
            log('d', 4, { distanceKm: 150 }),
        ]);
        const patches = plan.groups[0];
        expect(patches.get('b')?.odometerKm).toBe(9_800);
        expect(patches.get('a')?.odometerKm).toBe(9_500);
        expect(patches.get('d')?.odometerKm).toBe(10_150);
        expect(plan.odometerReconstructed).toBe(3);
        // Reconstructed readings agree with the stored distances: none rewritten.
        expect(plan.distancesUpdated).toBe(0);
    });

    it('fixes distances that disagree with the readings', () => {
        const plan = planPhaseOne([
            log('a', 1, { odometerKm: 1000 }),
            log('b', 2, { odometerKm: 1300, distanceKm: 999 }),
            log('c', 3, { odometerKm: 1600, distanceKm: 300.4 }), // within 1 km: kept
        ]);
        const patches = plan.groups[0];
        expect(patches.get('b')).toMatchObject({ distanceKm: 300, kmPerLitre: 7.5 });
        expect(patches.get('c')?.distanceKm).toBeUndefined();
        expect(plan.distancesUpdated).toBe(1);
    });

    it('counts vehicles with no reading and plans no distances for them', () => {
        const plan = planPhaseOne([log('a', 1, { vehicleId: 'v9', pricePerLitre: 1.5, kmPerLitre: 12.5 })]);
        expect(plan.vehiclesWithoutAnchor).toBe(1);
        expect(plan.groups).toEqual([]);
    });
});

describe('packBatches', () => {
    it('keeps groups together and respects the size cap', () => {
        expect(packBatches([[1, 2], [3, 4], [5]], 4)).toEqual([[1, 2, 3, 4], [5]]);
        expect(packBatches([[1], [2, 3, 4]], 3)).toEqual([[1], [2, 3, 4]]);
        expect(packBatches([[1, 2, 3, 4, 5]], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
});

describe('selectStationCandidates', () => {
    it('selects located logs without a station, in id order after the cursor', () => {
        const logs = [
            log('c', 1, { latitude: 1, longitude: 1 }),
            log('a', 1, { latitude: 1, longitude: 1 }),
            log('b', 1, { latitude: 1, longitude: 1, stationId: 's' }),
            log('d', 1),
        ];
        expect(selectStationCandidates(logs).map((l) => l.id)).toEqual(['a', 'c']);
        expect(selectStationCandidates(logs, 'a').map((l) => l.id)).toEqual(['c']);
    });
});

describe('migrateDerivedLogFields', () => {
    const history = () => [
        log('a', 1, { odometerKm: 1000 }),
        log('b', 2, { odometerKm: 1300, distanceKm: 999 }),
        log('c', 3, { distanceKm: 200 }), // readings reconstructed: c 1500, d 2000, e 2500
        log('d', 4, { latitude: 1, longitude: 1 }),
        log('e', 5, { latitude: 2, longitude: 2 }),
    ];
    const lookups = (): Lookups => ({
        findStation: vi.fn(async (lat: number) => (lat === 1 ? station(1) : null)),
        fetchRate: vi.fn(async () => null),
    });
    const fast = { sleep: async () => {} };

    it('dry run reports but writes nothing (no logs, no stations)', async () => {
        const f = fakeFirestore(asDocs(history()));
        const before = new Map(f.store);
        const r = await migrateDerivedLogFields(f.db, { apply: false, lookups: lookups(), ...fast });
        expect(r).toMatchObject({ logsScanned: 5, odometerReconstructed: 3, distancesUpdated: 1, stationsAssigned: 1, logsWritten: 0, done: true });
        expect(f.store).toEqual(before);
        expect(f.stats.batchCommits).toBe(0);
    });

    it('applies in batches and is a no-op when re-run', async () => {
        const f = fakeFirestore(asDocs(history()));
        const r = await migrateDerivedLogFields(f.db, { apply: true, lookups: lookups(), batchSize: 2, ...fast });
        expect(r.done).toBe(true);
        expect(f.store.get('fuelLogs/b')).toMatchObject({ distanceKm: 300, pricePerLitre: 1.5, kmPerLitre: 7.5 });
        expect(f.store.get('fuelLogs/c')).toMatchObject({ odometerKm: 1500, distanceKm: 200 });
        expect(f.store.get('fuelLogs/d')?.stationId).toBe('node_1');
        expect(f.store.get('fuelLogs/e')?.stationId).toBeUndefined();
        expect(f.store.get('stations/node_1')).toMatchObject({ logCount: 0, avgPrice: 0 });
        // 5 phase-one writes (every log gets pricePerLitre) in batches of 2, plus 1 station batch.
        expect(r.batchesCommitted).toBe(4);
        expect(r.logsWritten).toBe(6);

        const commits = f.stats.batchCommits;
        const again = await migrateDerivedLogFields(f.db, { apply: true, lookups: lookups(), batchSize: 2, ...fast });
        expect(again).toMatchObject({ odometerReconstructed: 0, distancesUpdated: 0, valuesUpdated: 0, stationsAssigned: 0, logsWritten: 0 });
        expect(f.stats.batchCommits).toBe(commits);
    });

    it('stops station lookups at the deadline and resumes from the cursor', async () => {
        const f = fakeFirestore(asDocs(history()));
        const l = lookups();
        const r1 = await migrateDerivedLogFields(f.db, { apply: true, lookups: l, deadline: 0, ...fast });
        expect(r1).toMatchObject({ done: false, stationsAssigned: 0 });
        expect(r1.cursor).toBeUndefined();
        const r2 = await migrateDerivedLogFields(f.db, { apply: true, lookups: l, cursor: 'd', ...fast });
        expect(r2.done).toBe(true);
        expect(l.findStation).toHaveBeenCalledTimes(1); // only 'e'
    });

    it('treats a failed lookup as unresolved and carries on', async () => {
        const f = fakeFirestore(asDocs(history()));
        const l: Lookups = { findStation: vi.fn(async () => { throw new Error('406'); }), fetchRate: vi.fn() };
        const r = await migrateDerivedLogFields(f.db, { apply: true, lookups: l, ...fast });
        expect(r).toMatchObject({ stationsUnresolved: 2, done: true });
    });
});

describe('runPendingMigrations', () => {
    it('records progress without completing, then resumes from the saved state', async () => {
        const f = fakeFirestore();
        const run = vi.fn()
            .mockResolvedValueOnce({ done: false, state: { cursor: 'x' }, n: 1 })
            .mockResolvedValueOnce({ n: 2 });
        const later = vi.fn(async () => ({}));
        const migrations: Migration[] = [{ id: 'm1', run }, { id: 'm2', run: later }];

        expect(await runPendingMigrations(f.db, migrations)).toEqual([]);
        expect(later).not.toHaveBeenCalled();
        expect(f.store.get('migrations/m1')).toMatchObject({ state: { cursor: 'x' }, lastRun: { n: 1 } });

        expect(await runPendingMigrations(f.db, migrations)).toEqual(['m1', 'm2']);
        expect(run).toHaveBeenLastCalledWith(f.db, { cursor: 'x' });
        expect(f.store.get('migrations/m1')).toMatchObject({ n: 2 });
        expect(f.store.get('migrations/m1')?.completedAt).toBeDefined();

        expect(await runPendingMigrations(f.db, migrations)).toEqual([]);
        expect(run).toHaveBeenCalledTimes(2);
    });
});

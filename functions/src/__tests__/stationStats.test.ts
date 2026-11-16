import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { applyContribution, contributionOf, handleLogWrite, type PriceStats } from '../stationStats';

const ts = (ms: number) => ({ toMillis: () => ms });
const log = (over: Record<string, unknown> = {}) => ({
    userId: 'u1', stationId: 's1', cost: 60, fuelAmountLiters: 40, timestamp: ts(1000), ...over,
});

describe('contributionOf', () => {
    it('computes price per litre in the owner home currency', () => {
        expect(contributionOf(log(), 'EUR')).toEqual({ stationId: 's1', currency: 'EUR', pricePerLitre: 1.5, at: 1000 });
    });

    it('ignores logs without a station or with unusable numbers', () => {
        expect(contributionOf(log({ stationId: undefined }), 'EUR')).toBeNull();
        expect(contributionOf(log({ fuelAmountLiters: 0 }), 'EUR')).toBeNull();
        expect(contributionOf(log({ cost: -1 }), 'EUR')).toBeNull();
        expect(contributionOf(log({ cost: '60' }), 'EUR')).toBeNull();
        expect(contributionOf(undefined, 'EUR')).toBeNull();
    });
});

describe('applyContribution', () => {
    const add = (price: number, at: number, currency = 'EUR') => ({ stationId: 's1', currency, pricePerLitre: price, at });

    it('adds, edits and removes symmetrically', () => {
        let s: PriceStats = {};
        s = applyContribution(s, null, add(1.5, 1));
        s = applyContribution(s, null, add(1.7, 2));
        expect(s.EUR).toMatchObject({ count: 2, avgPrice: 1.6, lastPrice: 1.7, lastAt: 2 });

        // Edit the second log's price.
        s = applyContribution(s, add(1.7, 2), add(1.9, 2));
        expect(s.EUR).toMatchObject({ count: 2, avgPrice: 1.7 });

        // Delete both.
        s = applyContribution(s, add(1.9, 2), null);
        s = applyContribution(s, add(1.5, 1), null);
        expect(s.EUR).toMatchObject({ count: 0, total: 0, avgPrice: 0, lastPrice: null });
    });

    it('keeps currencies separate', () => {
        let s: PriceStats = {};
        s = applyContribution(s, null, add(1.5, 1, 'EUR'));
        s = applyContribution(s, null, add(1.3, 2, 'GBP'));
        expect(s.EUR.avgPrice).toBe(1.5);
        expect(s.GBP.avgPrice).toBe(1.3);
    });

    it('does not let an older back-dated log overwrite lastPrice', () => {
        let s: PriceStats = {};
        s = applyContribution(s, null, add(1.8, 10));
        s = applyContribution(s, null, add(1.2, 5));
        expect(s.EUR.lastPrice).toBe(1.8);
    });

    it('never goes negative when removing from empty stats', () => {
        expect(applyContribution({}, add(1.5, 1), null)).toEqual({});
    });
});

/** Minimal in-memory Firestore for the transaction path. */
function fakeDb(initial: Record<string, Record<string, unknown>>) {
    const store = new Map(Object.entries(initial));
    const ref = (path: string) => ({ path });
    const db = {
        collection: (c: string) => ({ doc: (id: string) => ({ ...ref(`${c}/${id}`), get: async () => snap(`${c}/${id}`), set: async (data: Record<string, unknown>) => { store.set(`${c}/${id}`, data); } }) }),
        runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({
            get: async (r: { path: string }) => snap(r.path),
            update: (r: { path: string }, data: Record<string, unknown>) => store.set(r.path, { ...store.get(r.path), ...data }),
            set: (r: { path: string }, data: Record<string, unknown>) => store.set(r.path, data),
        }),
    };
    function snap(path: string) {
        return { exists: store.has(path), data: () => store.get(path) };
    }
    return { db: db as unknown as Firestore, store };
}

describe('handleLogWrite', () => {
    const base = () => ({
        'userProfiles/u1': { homeCurrency: 'EUR' },
        'stations/s1': { name: 'S1' },
        'stations/s2': { name: 'S2' },
    });

    it('applies a create once, even if the event is redelivered', async () => {
        const { db, store } = fakeDb(base());
        expect(await handleLogWrite(db, 'e1', undefined, log())).toBe('applied');
        expect(await handleLogWrite(db, 'e1', undefined, log())).toBe('duplicate');
        expect((store.get('stations/s1')!.priceStats as PriceStats).EUR.count).toBe(1);
    });

    it('moves the contribution when a log is re-linked to another station', async () => {
        const { db, store } = fakeDb(base());
        await handleLogWrite(db, 'e1', undefined, log());
        await handleLogWrite(db, 'e2', log(), log({ stationId: 's2' }));
        expect((store.get('stations/s1')!.priceStats as PriceStats).EUR.count).toBe(0);
        expect((store.get('stations/s2')!.priceStats as PriceStats).EUR.count).toBe(1);
    });

    it('skips writes that do not change the contribution (e.g. odometer edits)', async () => {
        const { db } = fakeDb(base());
        expect(await handleLogWrite(db, 'e1', log(), log({ odometerKm: 1234 }))).toBe('skipped');
        expect(await handleLogWrite(db, 'e2', { userId: 'u1' }, { userId: 'u1', cost: 5 })).toBe('skipped');
    });

    it('buckets by the owner home currency', async () => {
        const { db, store } = fakeDb({ ...base(), 'userProfiles/u1': { homeCurrency: 'GBP' } });
        await handleLogWrite(db, 'e1', undefined, log());
        expect(Object.keys(store.get('stations/s1')!.priceStats as PriceStats)).toEqual(['GBP']);
    });

    it('ignores logs pointing at a station document that does not exist', async () => {
        const { db, store } = fakeDb(base());
        await handleLogWrite(db, 'e1', undefined, log({ stationId: 'missing' }));
        expect(store.has('stations/missing')).toBe(false);
    });
});

describe('planStationStats (rebuild script planner)', () => {
    it('matches what the trigger produces incrementally', async () => {
        const { planStationStats } = await import('../stationStats');
        const logs = [
            log({ cost: 60, fuelAmountLiters: 40, timestamp: ts(1) }),
            log({ cost: 70, fuelAmountLiters: 40, timestamp: ts(2) }),
            log({ userId: 'u2', cost: 50, fuelAmountLiters: 40, timestamp: ts(3) }),
            log({ stationId: undefined }),
        ];
        const plan = planStationStats(logs, new Map([['u1', 'EUR'], ['u2', 'GBP']]));
        expect(plan.get('s1')).toEqual({
            EUR: { count: 2, total: 3.25, avgPrice: 1.625, lastPrice: 1.75, lastAt: 2 },
            GBP: { count: 1, total: 1.25, avgPrice: 1.25, lastPrice: 1.25, lastAt: 3 },
        });
    });
});

describe('runPendingMigrations', () => {
    it('runs each migration once and records completion', async () => {
        const { runPendingMigrations } = await import('../migrations');
        const { db, store } = fakeDb({});
        let calls = 0;
        const migrations = [{ id: 'm1', run: async () => { calls++; return { ok: true }; } }];
        expect(await runPendingMigrations(db, migrations)).toEqual(['m1']);
        expect(await runPendingMigrations(db, migrations)).toEqual([]);
        expect(calls).toBe(1);
        expect(store.get('migrations/m1')).toMatchObject({ ok: true });
    });
});

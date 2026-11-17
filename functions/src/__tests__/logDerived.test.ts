import { describe, it, expect, vi } from 'vitest';
import {
    handleLogDerivedWrite, nextReadingAfter, odometerInputsChanged, planDistanceUpdates, rateDate, valuePatch,
    type DerivedLog, type GroupLog, type Lookups,
} from '../logDerived';
import { fakeFirestore, ts, DAY } from './fakeFirestore';

const log = (id: string, day: number, odometerKm?: number, over: Partial<DerivedLog> = {}): GroupLog => ({
    id, userId: 'u1', vehicleId: 'v1', timestamp: ts(day * DAY), fuelAmountLiters: 40, cost: 60, distanceKm: 500,
    ...(odometerKm !== undefined && { odometerKm }), ...over,
});
const strip = (l: GroupLog): DerivedLog => {
    const rest: Partial<GroupLog> = { ...l };
    delete rest.id;
    return rest;
};

const noLookups = (): Lookups => ({
    findStation: vi.fn(async () => null),
    fetchRate: vi.fn(async () => null),
});

/** Seeds a fake db with logs (already carrying their derived values, as if settled). */
function seed(logs: GroupLog[], extra: Record<string, Record<string, unknown>> = {}) {
    const docs: Record<string, Record<string, unknown>> = { 'userProfiles/u1': { homeCurrency: 'EUR' }, ...extra };
    for (const l of logs) {
        const settled: DerivedLog = { ...strip(l), ...valuePatch(l) } as DerivedLog;
        docs[`fuelLogs/${l.id}`] = settled as Record<string, unknown>;
    }
    return fakeFirestore(docs);
}

/** Writes `after` to the store as the client would, then runs the trigger for that write. */
async function write(
    f: ReturnType<typeof fakeFirestore>, id: string, after: DerivedLog | undefined, eventId: string, lookups = noLookups(),
) {
    const before = f.store.get(`fuelLogs/${id}`) as DerivedLog | undefined;
    if (after) f.store.set(`fuelLogs/${id}`, { ...after } as Record<string, unknown>);
    else f.store.delete(`fuelLogs/${id}`);
    return handleLogDerivedWrite(f.db, eventId, id, before, after, lookups);
}
const doc = (f: ReturnType<typeof fakeFirestore>, id: string) => f.store.get(`fuelLogs/${id}`) as DerivedLog;

describe('pure helpers', () => {
    it('valuePatch derives price per litre and efficiency, and is empty once settled', () => {
        const l = log('a', 1, 1000, { cost: 60, fuelAmountLiters: 40, distanceKm: 600 });
        const p = valuePatch(l);
        expect(p).toEqual({ pricePerLitre: 1.5, kmPerLitre: 15 });
        expect(valuePatch({ ...l, ...p } as DerivedLog)).toEqual({});
    });

    it('valuePatch removes values that can no longer be derived', () => {
        expect(valuePatch({ cost: 0, fuelAmountLiters: 40, pricePerLitre: 1.5 })).toEqual({ pricePerLitre: null });
    });

    it('odometerInputsChanged ignores edits that cannot move a distance', () => {
        const a = log('a', 1, 1000);
        expect(odometerInputsChanged(a, { ...a, cost: 99, distanceKm: 1, stationId: 's' })).toBe(false);
        expect(odometerInputsChanged(a, { ...a, odometerKm: 1001 })).toBe(true);
        expect(odometerInputsChanged(a, { ...a, timestamp: ts(5) })).toBe(true);
        expect(odometerInputsChanged(a, { ...a, vehicleId: 'v2' })).toBe(true);
        expect(odometerInputsChanged(undefined, a)).toBe(true);
        expect(odometerInputsChanged(a, undefined)).toBe(true);
        const noOdo = log('b', 1);
        expect(odometerInputsChanged(undefined, noOdo)).toBe(false);
        expect(odometerInputsChanged(noOdo, { ...noOdo, timestamp: ts(9) })).toBe(false);
    });

    it('nextReadingAfter skips logs without a reading', () => {
        const g = [log('a', 1, 1000), log('b', 2), log('c', 3, 1600)];
        expect(nextReadingAfter(g, 1 * DAY, 'a', 'a')?.id).toBe('c');
        expect(nextReadingAfter(g, 3 * DAY, 'c', 'c')).toBeUndefined();
    });

    it('planDistanceUpdates for an insert in the middle fixes the new log and the next one', () => {
        const logs = [log('a', 1, 1000), log('c', 3, 1600, { distanceKm: 600 }), log('b', 2, 1250, { distanceKm: 999 })];
        const plan = planDistanceUpdates('b', undefined, strip(logs[2]), logs);
        expect(plan.get('b')?.distanceKm).toBe(250);
        expect(plan.get('c')?.distanceKm).toBe(350);
        expect(plan.has('a')).toBe(false);
    });

    it('rateDate prefers the writer local date, else the UTC date', () => {
        expect(rateDate({ localDate: '2026-03-01', timestamp: ts(Date.UTC(2026, 1, 28, 23)) })).toBe('2026-03-01');
        expect(rateDate({ timestamp: ts(Date.UTC(2026, 1, 28, 23)) })).toBe('2026-02-28');
        expect(rateDate({ localDate: 'yesterday' })).toBeNull();
    });
});

describe('handleLogDerivedWrite: distances', () => {
    it('derives the distance of a new log from the previous reading', async () => {
        const f = seed([log('a', 1, 1000)]);
        expect(await write(f, 'b', strip(log('b', 2, 1420, { distanceKm: 1 })), 'e1')).toBe('applied');
        expect(doc(f, 'b')).toMatchObject({ distanceKm: 420, kmPerLitre: 10.5, pricePerLitre: 1.5 });
    });

    it('recomputes the next log when a log is inserted in the middle', async () => {
        const f = seed([log('a', 1, 1000), log('c', 3, 1600, { distanceKm: 600 })]);
        await write(f, 'b', strip(log('b', 2, 1250, { distanceKm: 250 })), 'e1');
        expect(doc(f, 'b').distanceKm).toBe(250);
        expect(doc(f, 'c')).toMatchObject({ distanceKm: 350, kmPerLitre: 8.75 });
        expect(doc(f, 'a').distanceKm).toBe(500); // first reading: nothing earlier, left as entered
    });

    it('recomputes both old and new neighbours when a log is back-dated', async () => {
        // a(1)=1000, b(2)=1300, c(3)=1600, d(4)=1900 → move d's... back-date c to day 1.5 with reading 1100.
        const f = seed([
            log('a', 1, 1000), log('b', 2, 1300, { distanceKm: 300 }),
            log('c', 3, 1600, { distanceKm: 300 }), log('d', 4, 1900, { distanceKm: 300 }),
        ]);
        await write(f, 'c', strip(log('c', 1.5, 1100, { distanceKm: 300 })), 'e1');
        expect(doc(f, 'c').distanceKm).toBe(100); // 1100 - 1000
        expect(doc(f, 'b').distanceKm).toBe(200); // new next: 1300 - 1100
        expect(doc(f, 'd').distanceKm).toBe(600); // old next: 1900 - 1300
    });

    it('recomputes the edited log and the next one when a reading is edited', async () => {
        const f = seed([log('a', 1, 1000), log('b', 2, 1300, { distanceKm: 300 }), log('c', 3, 1600, { distanceKm: 300 })]);
        await write(f, 'b', strip(log('b', 2, 1400, { distanceKm: 300 })), 'e1');
        expect(doc(f, 'b').distanceKm).toBe(400);
        expect(doc(f, 'c').distanceKm).toBe(200);
    });

    it('recomputes the next log when a middle log is deleted', async () => {
        const f = seed([log('a', 1, 1000), log('b', 2, 1300, { distanceKm: 300 }), log('c', 3, 1600, { distanceKm: 300 })]);
        expect(await write(f, 'b', undefined, 'e1')).toBe('applied');
        expect(doc(f, 'c')).toMatchObject({ distanceKm: 600, kmPerLitre: 15 });
    });

    it('leaves a log without an odometer reading alone and fixes the next reading', async () => {
        const f = seed([log('a', 1, 1000), log('c', 3, 1600, { distanceKm: 600 })]);
        // b has no reading: its distance is user-entered and stays.
        await write(f, 'b', strip(log('b', 2, undefined, { distanceKm: 123 })), 'e1');
        expect(doc(f, 'b').distanceKm).toBe(123);
        expect(doc(f, 'c').distanceKm).toBe(600);
        // Removing a's reading leaves c with nothing earlier: its stored distance stays.
        await write(f, 'a', strip(log('a', 1, undefined)), 'e2');
        expect(doc(f, 'c').distanceKm).toBe(600);
    });

    it('does not cross vehicles', async () => {
        const f = seed([log('a', 1, 1000), log('x', 2, 50_000, { vehicleId: 'v2', distanceKm: 400 })]);
        await write(f, 'b', strip(log('b', 3, 1300, { distanceKm: 300 })), 'e1');
        expect(doc(f, 'x').distanceKm).toBe(400);
        expect(doc(f, 'b').distanceKm).toBe(300);
    });

    it('keeps a stored distance within 1 km of the derived one', async () => {
        const f = seed([log('a', 1, 1000)]);
        await write(f, 'b', strip(log('b', 2, 1412, { distanceKm: 412.3 })), 'e1');
        expect(doc(f, 'b').distanceKm).toBe(412.3);
    });
});

describe('handleLogDerivedWrite: no-ops, loops and redelivery', () => {
    it('writes nothing when nothing changed', async () => {
        const f = seed([log('a', 1, 1000), log('b', 2, 1300, { distanceKm: 300 })]);
        const before = { ...doc(f, 'b') };
        const lookups = noLookups();
        expect(await handleLogDerivedWrite(f.db, 'e1', 'b', before, { ...before }, lookups)).toBe('skipped');
        expect(f.stats.updates).toBe(0);
        expect(f.stats.queries).toBe(0);
        expect(lookups.findStation).not.toHaveBeenCalled();
    });

    it("converges: its own writes re-fire as no-ops", async () => {
        const f = seed([log('a', 1, 1000), log('c', 3, 1600, { distanceKm: 600 })]);
        const before = f.store.get('fuelLogs/c') as DerivedLog;
        await write(f, 'b', strip(log('b', 2, 1250, { distanceKm: 1, latitude: 53, longitude: -6 })), 'e1');
        const updates = f.stats.updates;
        // Re-fire for the trigger's write to c (and to b): nothing further.
        expect(await handleLogDerivedWrite(f.db, 'e2', 'c', before, doc(f, 'c'))).toBe('skipped');
        const bAfterOwnWrite = doc(f, 'b');
        expect(await handleLogDerivedWrite(f.db, 'e3', 'b', { ...bAfterOwnWrite, distanceKm: 1 }, bAfterOwnWrite, noLookups())).toBe('skipped');
        expect(f.stats.updates).toBe(updates);
    });

    it('applies a redelivered event once', async () => {
        const f = seed([log('a', 1, 1000)]);
        const after = strip(log('b', 2, 1420, { distanceKm: 1 }));
        f.store.set('fuelLogs/b', { ...after } as Record<string, unknown>);
        expect(await handleLogDerivedWrite(f.db, 'e1', 'b', undefined, after, noLookups())).toBe('applied');
        expect(await handleLogDerivedWrite(f.db, 'e1', 'b', undefined, after, noLookups())).toBe('duplicate');
        expect(f.store.has('triggerEvents/logDerived_e1')).toBe(true);
    });

    it('skips a log whose inputs changed after the event (a newer event handles it)', async () => {
        const f = seed([log('a', 1, 1000)]);
        const after = strip(log('b', 2, 1420, { distanceKm: 1 }));
        f.store.set('fuelLogs/b', { ...after, odometerKm: 9999 } as Record<string, unknown>);
        await handleLogDerivedWrite(f.db, 'e1', 'b', undefined, after, noLookups());
        expect(doc(f, 'b').distanceKm).toBe(1);
    });
});

describe('handleLogDerivedWrite: station', () => {
    const shell = { id: 'node/1', osmId: 'node/1', name: 'Shell', brand: 'Shell', latitude: 53, longitude: -6 };

    it('links the nearest station, creating its document without touching price stats', async () => {
        const f = seed([]);
        const lookups = { ...noLookups(), findStation: vi.fn(async () => shell) };
        await write(f, 'b', strip(log('b', 2, undefined, { latitude: 53, longitude: -6 })), 'e1', lookups);
        expect(doc(f, 'b').stationId).toBe('node_1');
        expect(f.store.get('stations/node_1')).toEqual({
            osmId: 'node/1', name: 'Shell', brand: 'Shell', latitude: 53, longitude: -6, address: '', logCount: 0, avgPrice: 0,
        });
    });

    it('reuses an existing station document as-is', async () => {
        const existing = { osmId: 'node/1', name: 'Shell', priceStats: { EUR: { count: 3 } } };
        const f = seed([], { 'stations/node_1': existing });
        const lookups = { ...noLookups(), findStation: vi.fn(async () => shell) };
        await write(f, 'b', strip(log('b', 2, undefined, { latitude: 53, longitude: -6 })), 'e1', lookups);
        expect(doc(f, 'b').stationId).toBe('node_1');
        expect(f.store.get('stations/node_1')).toEqual(existing);
    });

    it('leaves stationId unset and still derives the rest when the lookup fails', async () => {
        const f = seed([log('a', 1, 1000)]);
        const lookups = { ...noLookups(), findStation: vi.fn(async () => { throw new Error('Overpass 504'); }) };
        await expect(write(f, 'b', strip(log('b', 2, 1300, { distanceKm: 1, latitude: 53, longitude: -6 })), 'e1', lookups))
            .resolves.toBe('applied');
        expect(doc(f, 'b').stationId).toBeUndefined();
        expect(doc(f, 'b').distanceKm).toBe(300);
    });

    it('does not look up again on edits that keep the same coordinates', async () => {
        const f = seed([]);
        const lookups = noLookups();
        await write(f, 'b', strip(log('b', 2, undefined, { latitude: 53, longitude: -6 })), 'e1', lookups);
        await write(f, 'b', { ...doc(f, 'b'), cost: 70 }, 'e2', lookups);
        expect(lookups.findStation).toHaveBeenCalledTimes(1);
    });

    it('never replaces a station the writer set', async () => {
        const f = seed([]);
        const lookups = noLookups();
        await write(f, 'b', strip(log('b', 2, undefined, { latitude: 53, longitude: -6, stationId: 'mine' })), 'e1', lookups);
        expect(lookups.findStation).not.toHaveBeenCalled();
        expect(doc(f, 'b').stationId).toBe('mine');
    });
});

describe('handleLogDerivedWrite: home-currency cost', () => {
    const foreign = (over: Partial<DerivedLog> = {}) => {
        const l = strip(log('b', 2, undefined, { originalCost: 50, currency: 'GBP', ...over }));
        delete l.cost;
        return l;
    };

    it('fills cost and exchangeRate from originalCost when cost is missing', async () => {
        const f = seed([]);
        const lookups = { ...noLookups(), fetchRate: vi.fn(async () => 1.2) };
        await write(f, 'b', foreign({ localDate: '2026-01-05' }), 'e1', lookups);
        expect(lookups.fetchRate).toHaveBeenCalledWith('2026-01-05', 'GBP', 'EUR');
        expect(doc(f, 'b')).toMatchObject({ cost: 60, exchangeRate: 1.2, pricePerLitre: 1.5 });
    });

    it('uses a rate of 1 for the home currency without fetching', async () => {
        const f = seed([]);
        const lookups = noLookups();
        await write(f, 'b', foreign({ currency: 'EUR' }), 'e1', lookups);
        expect(lookups.fetchRate).not.toHaveBeenCalled();
        expect(doc(f, 'b')).toMatchObject({ cost: 50, exchangeRate: 1 });
    });

    it('leaves cost alone when the client already wrote it, or the rate is unavailable', async () => {
        const f = seed([]);
        const lookups = noLookups();
        await write(f, 'a', strip(log('a', 1, undefined, { originalCost: 50, currency: 'GBP', cost: 58 })), 'e1', lookups);
        expect(lookups.fetchRate).not.toHaveBeenCalled();
        expect(doc(f, 'a').cost).toBe(58);
        await write(f, 'b', foreign(), 'e2', lookups);
        expect(doc(f, 'b').cost).toBeUndefined();
    });
});

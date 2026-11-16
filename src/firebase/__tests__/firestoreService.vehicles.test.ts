import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs } from 'firebase/firestore';
import { auth } from '../config';
import { fetchVehicles, pickDefaultVehicle, getLastOdometerReading } from '../firestoreService';
import { parseDoc, resetReported, vehicleSchema } from '../converters';

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDocs: vi.fn(),
    Timestamp: { fromDate: vi.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })) },
  };
});

vi.mock('../config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock('@sentry/react', () => sentry);

const ts = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => new Date(iso).getTime() });

function snapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  const wrapped = docs.map(d => ({ id: d.id, data: () => d.data }));
  return { empty: wrapped.length === 0, docs: wrapped, forEach: (cb: (d: (typeof wrapped)[number]) => void) => wrapped.forEach(cb) };
}

const vehicle = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, data: { userId: 'u1', name, make: 'Toyota', model: 'Yaris', year: '2020', fuelType: 'Petrol', isDefault: false, ...extra },
});

describe('fetchVehicles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active vehicles sorted by name', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshot([
      vehicle('b', 'Zed'), vehicle('a', 'Alpha'), vehicle('c', 'Old', { isArchived: true }),
    ]) as never);
    const list = await fetchVehicles('u1');
    expect(list.map(v => v.id)).toEqual(['a', 'b']);
  });

  it('includes archived vehicles when asked', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshot([vehicle('a', 'A'), vehicle('c', 'Old', { isArchived: true })]) as never);
    expect((await fetchVehicles('u1', { includeArchived: true })).map(v => v.id)).toEqual(['a', 'c']);
  });

  it('normalises legacy numeric years to strings', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshot([vehicle('a', 'A', { year: 2015 })]) as never);
    expect((await fetchVehicles('u1'))[0].year).toBe('2015');
  });

  it('pickDefaultVehicle prefers the default, else the first', () => {
    const a = { id: 'a', isDefault: false } as never;
    const b = { id: 'b', isDefault: true } as never;
    expect(pickDefaultVehicle([a, b])).toBe(b);
    expect(pickDefaultVehicle([a])).toBe(a);
    expect(pickDefaultVehicle([])).toBeUndefined();
  });
});

describe('getLastOdometerReading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, 'currentUser', 'get').mockReturnValue({ uid: 'u1' } as never);
  });

  const log = (id: string, iso: string, odometerKm?: number) => ({
    id, data: { userId: 'u1', vehicleId: 'v1', timestamp: ts(iso), cost: 50, distanceKm: 400, fuelAmountLiters: 30, ...(odometerKm !== undefined && { odometerKm }) },
  });

  it('skips recent logs without a reading instead of returning null', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshot([
      log('new', '2026-11-10T10:00:00Z'),            // no odometer
      log('old', '2026-11-01T10:00:00Z', 12000),
    ]) as never);
    expect(await getLastOdometerReading('v1', new Date('2026-11-15T00:00:00Z'))).toBe(12000);
  });

  it('returns null when no earlier log has a reading', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshot([log('a', '2026-11-10T10:00:00Z')]) as never);
    expect(await getLastOdometerReading('v1')).toBeNull();
  });
});

describe('parseDoc', () => {
  beforeEach(() => { vi.clearAllMocks(); resetReported(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('returns invalid documents unchanged but reports them once', () => {
    const bad = { userId: 'u1', name: 'X', make: 'M', model: 'Y', year: '2020', fuelType: 'Coal' };
    expect(parseDoc(vehicleSchema, 'vehicle', 'v1', bad)).toBe(bad);
    parseDoc(vehicleSchema, 'vehicle', 'v1', bad);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('does not report valid documents', () => {
    parseDoc(vehicleSchema, 'vehicle', 'v2', vehicle('v2', 'ok').data);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });
});

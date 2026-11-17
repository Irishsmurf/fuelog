import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addDoc, updateDoc, deleteDoc, doc, getDocs, where, Timestamp } from 'firebase/firestore';
import { addLog, deleteLog, fetchLogsSince, updateLog, type NewFuelLog } from '../logs';

vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({ path: 'fuelLogs' })),
    doc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    query: vi.fn((_c: unknown, ...cs: unknown[]) => ({ cs })),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

const newLog = { userId: 'u1', vehicleId: 'v1', cost: 50, distanceKm: 400, fuelAmountLiters: 30, brand: 'Esso' } as unknown as NewFuelLog;

const setOnline = (value: boolean) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

describe('addLog', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { delete (window.navigator as unknown as Record<string, unknown>).onLine; });

  it('waits for the server write when online', async () => {
    setOnline(true);
    let ack!: () => void;
    vi.mocked(addDoc).mockReturnValue(new Promise(r => { ack = () => r({} as never); }) as never);
    let settled = false;
    const p = addLog(newLog).then(r => { settled = true; return r; });
    await Promise.resolve();
    expect(settled).toBe(false);
    ack();
    await expect(p).resolves.toEqual({ savedOffline: false });
    expect(vi.mocked(addDoc).mock.calls[0][1]).toBe(newLog);
  });

  it('resolves at once offline, while the queued write is still pending', async () => {
    setOnline(false);
    vi.mocked(addDoc).mockReturnValue(new Promise(() => {}) as never);
    await expect(addLog(newLog)).resolves.toEqual({ savedOffline: true });
  });

  it('does not leave an unhandled rejection when a queued write later fails', async () => {
    setOnline(false);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(addDoc).mockReturnValue(Promise.reject(new Error('rules')) as never);
    await addLog(newLog);
    await new Promise(r => setTimeout(r, 0));
    expect(err).toHaveBeenCalledWith('Queued fuel log failed to sync:', expect.any(Error));
    err.mockRestore();
  });

  it('rejects when an online write fails', async () => {
    setOnline(true);
    vi.mocked(addDoc).mockRejectedValue(new Error('permission-denied'));
    await expect(addLog(newLog)).rejects.toThrow('permission-denied');
  });
});

describe('updateLog / deleteLog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the log document with exactly the given fields', async () => {
    await updateLog('log1', { cost: 66 });
    expect(doc).toHaveBeenCalledWith({}, 'fuelLogs', 'log1');
    expect(updateDoc).toHaveBeenCalledWith({ path: 'fuelLogs/log1' }, { cost: 66 });
  });

  it('deletes the log document', async () => {
    await deleteLog('log1');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'fuelLogs/log1' });
  });
});

describe('fetchLogsSince', () => {
  beforeEach(() => vi.clearAllMocks());

  const ts = { toDate: () => new Date(), toMillis: () => 0 };
  const snapOf = (ids: string[]) => ({
    docs: ids.map(id => ({ id, data: () => ({ userId: 'u1', timestamp: ts, cost: 1, distanceKm: 1, fuelAmountLiters: 1 }) })),
  });

  it('filters by user and start date, and parses documents with their ids', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapOf(['a', 'b']) as never);
    const since = new Date(2026, 5, 1);
    const logs = await fetchLogsSince('u1', since);
    expect(logs.map(l => l.id)).toEqual(['a', 'b']);
    expect(where).toHaveBeenCalledWith('userId', '==', 'u1');
    const tsCall = vi.mocked(where).mock.calls.find(c => c[0] === 'timestamp');
    expect(tsCall?.[1]).toBe('>=');
    expect((tsCall?.[2] as Timestamp).toDate()).toEqual(since);
    expect(vi.mocked(where).mock.calls.some(c => c[0] === 'vehicleId')).toBe(false);
  });

  it('adds a vehicle filter when given one', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapOf([]) as never);
    await fetchLogsSince('u1', new Date(), 'v9');
    expect(where).toHaveBeenCalledWith('vehicleId', '==', 'v9');
  });
});

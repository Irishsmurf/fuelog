import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs, startAfter } from 'firebase/firestore';
import { fetchLogsPage, fetchAllLogs, fetchRecentBrands, MAX_EXPORT_LOGS } from '../logs';
import { limit } from 'firebase/firestore';

vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

// In-memory "collection": an ordered list of docs; startAfter/limit honoured.
const store = vi.hoisted(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    where: vi.fn(() => ({ type: 'where' })),
    orderBy: vi.fn(() => ({ type: 'orderBy' })),
    limit: vi.fn((n: number) => ({ type: 'limit', n })),
    startAfter: vi.fn((cursor: { id: string }) => ({ type: 'startAfter', cursor })),
    query: vi.fn((_c: unknown, ...cs: { type: string; n?: number; cursor?: { id: string } }[]) => ({ cs })),
    getDocs: vi.fn(async (q: { cs: { type: string; n?: number; cursor?: { id: string } }[] }) => {
      const after = q.cs.find(c => c.type === 'startAfter')?.cursor;
      const n = q.cs.find(c => c.type === 'limit')?.n ?? Infinity;
      const start = after ? store.docs.findIndex(d => d.id === after.id) + 1 : 0;
      const docs = store.docs.slice(start, start + n);
      return { docs, empty: docs.length === 0 };
    }),
    Timestamp: { fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});

const ts = { toDate: () => new Date(), toMillis: () => 0 };
const makeLogs = (n: number, brandOf: (i: number) => string) => {
  store.docs = Array.from({ length: n }, (_, i) => ({
    id: `log${i}`,
    data: () => ({ userId: 'u1', timestamp: ts, brand: brandOf(i), cost: 50, distanceKm: 400, fuelAmountLiters: 30 }),
  }));
};

describe('fetchLogsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a page and a cursor while more remain', async () => {
    makeLogs(60, () => 'Esso');
    const p1 = await fetchLogsPage('u1', {}, null, 25);
    expect(p1.logs).toHaveLength(25);
    expect(p1.nextCursor?.id).toBe('log24');
    const p3 = await fetchLogsPage('u1', {}, store.docs[49] as never, 25);
    expect(p3.logs).toHaveLength(10);
    expect(p3.nextCursor).toBeNull();
  });

  it('keeps scanning so a rare brand still fills the page (no false "no more logs")', async () => {
    // Only every 20th log is Circle K: none in the first raw page of 25.
    makeLogs(300, i => (i % 20 === 19 ? 'Circle K' : 'Esso'));
    const page = await fetchLogsPage('u1', { brand: 'Circle K' }, null, 5);
    expect(page.logs.map(l => l.id)).toEqual(['log19', 'log39', 'log59', 'log79', 'log99']);
    expect(page.nextCursor?.id).toBe('log99');
    const next = await fetchLogsPage('u1', { brand: 'Circle K' }, page.nextCursor, 5);
    expect(next.logs[0].id).toBe('log119');
    expect(vi.mocked(startAfter)).toHaveBeenCalled();
  });

  it('reports no next page when the brand has no further matches', async () => {
    makeLogs(40, i => (i === 3 ? 'Circle K' : 'Esso'));
    const page = await fetchLogsPage('u1', { brand: 'Circle K' }, null, 25);
    expect(page.logs.map(l => l.id)).toEqual(['log3']);
    expect(page.nextCursor).toBeNull();
  });

  it('collects distinct real brands for the filter dropdown', async () => {
    makeLogs(4, i => ['Esso', 'Unknown', 'Shell ', ''][i]);
    const page = await fetchLogsPage('u1', {}, null, 25);
    expect(page.brands.sort()).toEqual(['Esso', 'Shell']);
  });
});

describe('fetchAllLogs (exports)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns every matching log, not just the first page', async () => {
    makeLogs(530, i => (i % 2 ? 'Esso' : 'Shell'));
    const { logs, truncated } = await fetchAllLogs('u1', { brand: 'Shell' });
    expect(logs).toHaveLength(265);
    expect(truncated).toBe(false);
    expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(1);
  });

  it('caps very large exports and says so', async () => {
    makeLogs(MAX_EXPORT_LOGS + 50, () => 'Esso');
    const { logs, truncated } = await fetchAllLogs('u1', {});
    expect(logs).toHaveLength(MAX_EXPORT_LOGS);
    expect(truncated).toBe(true);
  });
});

describe('fetchRecentBrands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads a bounded window of recent logs and returns sorted distinct brands', async () => {
    makeLogs(1000, i => ['Shell', 'Esso', 'Unknown', 'Applegreen'][i % 4]);
    const brands = await fetchRecentBrands('u1', 200);
    expect(brands).toEqual(['Applegreen', 'Esso', 'Shell']);
    expect(vi.mocked(limit)).toHaveBeenCalledWith(200);
  });
});

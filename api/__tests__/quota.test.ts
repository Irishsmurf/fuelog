import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { consumeDailyQuota, receiptDailyLimit, DEFAULT_RECEIPT_DAILY_LIMIT } from '../_quota';

/** Minimal in-memory stand-in for the Admin SDK transaction API. */
function fakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  const db = {
    collection: (c: string) => ({ doc: (id: string) => ({ path: `${c}/${id}` }) }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({
      get: async (ref: { path: string }) => ({
        exists: store.has(ref.path),
        data: () => store.get(ref.path),
      }),
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
      },
    }),
  };
  return { db: db as unknown as Firestore, store };
}

describe('consumeDailyQuota', () => {
  const day = new Date('2026-11-16T12:00:00Z');

  it('allows up to the limit, then refuses', async () => {
    const { db } = fakeDb();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeDailyQuota(db, 'u1', 'receipt', 3, day));
    expect(results).toEqual([true, true, true, false]);
  });

  it('keeps separate counters per user and per day', async () => {
    const { db, store } = fakeDb();
    await consumeDailyQuota(db, 'u1', 'receipt', 1, day);
    expect(await consumeDailyQuota(db, 'u2', 'receipt', 1, day)).toBe(true);
    expect(await consumeDailyQuota(db, 'u1', 'receipt', 1, new Date('2026-11-17T00:00:01Z'))).toBe(true);
    expect([...store.keys()]).toContain('usageQuotas/u1_receipt_2026-11-16');
  });
});

describe('receiptDailyLimit', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults when unset or invalid', () => {
    vi.stubEnv('RECEIPT_DAILY_LIMIT', '');
    expect(receiptDailyLimit()).toBe(DEFAULT_RECEIPT_DAILY_LIMIT);
    vi.stubEnv('RECEIPT_DAILY_LIMIT', 'abc');
    expect(receiptDailyLimit()).toBe(DEFAULT_RECEIPT_DAILY_LIMIT);
  });

  it('reads a positive override', () => {
    vi.stubEnv('RECEIPT_DAILY_LIMIT', '10');
    expect(receiptDailyLimit()).toBe(10);
  });
});

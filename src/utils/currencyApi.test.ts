import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchExchangeRate, toLocalYmd } from './currencyApi';

describe('toLocalYmd', () => {
  it('formats the local calendar date, not the UTC one', () => {
    // 23:30 local time: toISOString() would roll over to the next day east of UTC.
    expect(toLocalYmd(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15');
    expect(toLocalYmd(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('fetchExchangeRate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the rate for the local fill-up date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 1.17 } }) });
    vi.stubGlobal('fetch', fetchMock);
    const rate = await fetchExchangeRate(new Date(2026, 10, 15, 23, 30), 'GBP', 'EUR');
    expect(rate).toBe(1.17);
    expect(fetchMock.mock.calls[0][0]).toContain('/2026-11-15?from=GBP&to=EUR');
  });

  it('short-circuits the same currency', async () => {
    expect(await fetchExchangeRate(new Date(), 'EUR', 'EUR')).toBe(1);
  });
});

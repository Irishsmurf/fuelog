import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchExchangeRate, findNearestStation } from '../lookups';

const json = (body: unknown, status = 200) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe('findNearestStation', () => {
    it('returns the nearest station and identifies itself to Overpass', async () => {
        const fetchMock = vi.fn(async () => json({ elements: [{ type: 'node', id: 1, lat: 53.3, lon: -6.2, tags: { amenity: 'fuel', name: 'Shell' } }] }));
        vi.stubGlobal('fetch', fetchMock);
        expect((await findNearestStation(53.3, -6.2))?.name).toBe('Shell');
        const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
        expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/fuelog/);
    });

    it('returns null when nothing is nearby', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json({ elements: [] })));
        expect(await findNearestStation(53.3, -6.2)).toBeNull();
    });

    it('retries a 429 and throws on a 406 without retrying', async () => {
        vi.useFakeTimers();
        const retry = vi.fn()
            .mockResolvedValueOnce(json({}, 429))
            .mockResolvedValueOnce(json({ elements: [] }));
        vi.stubGlobal('fetch', retry);
        const p = findNearestStation(1, 1);
        await vi.runAllTimersAsync();
        expect(await p).toBeNull();
        expect(retry).toHaveBeenCalledTimes(2);
        vi.useRealTimers();

        const rejected = vi.fn(async () => json({}, 406));
        vi.stubGlobal('fetch', rejected);
        await expect(findNearestStation(1, 1)).rejects.toThrow('406');
        expect(rejected).toHaveBeenCalledTimes(1);
    });
});

describe('fetchExchangeRate', () => {
    it('returns the rate for the day', async () => {
        const fetchMock = vi.fn(async () => json({ rates: { EUR: 1.17 } }));
        vi.stubGlobal('fetch', fetchMock);
        expect(await fetchExchangeRate('2026-01-05', 'GBP', 'EUR')).toBe(1.17);
        expect(fetchMock).toHaveBeenCalledWith('https://api.frankfurter.app/2026-01-05?from=GBP&to=EUR', expect.anything());
    });

    it('is 1 for the same currency, and null (never throws) on failure', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        expect(await fetchExchangeRate('2026-01-05', 'EUR', 'EUR')).toBe(1);
        expect(await fetchExchangeRate('2026-01-05', 'GBP', 'EUR')).toBeNull();
        vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'not found' }, 404)));
        expect(await fetchExchangeRate('2026-01-05', 'GBP', 'EUR')).toBeNull();
    });
});

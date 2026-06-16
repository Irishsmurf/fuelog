import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collection, query, where, getAggregateFromServer } from 'firebase/firestore';
import { getLifetimeStats } from './aggregationService';

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        getAggregateFromServer: vi.fn(),
    };
});

vi.mock('./config', () => ({
    db: {},
}));

describe('aggregationService', () => {
    const mockUserId = 'testUserId';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(collection).mockReturnValue({} as never);
        vi.mocked(query).mockReturnValue({} as never);
        vi.mocked(where).mockReturnValue({} as never);
    });

    it('computes lifetime stats from aggregate fixture data', async () => {
        vi.mocked(getAggregateFromServer).mockResolvedValue({
            data: () => ({
                totalCost: 245.5,
                totalLitres: 120.25,
                totalDistanceKm: 1800,
                logCount: 12,
            }),
        } as never);

        const result = await getLifetimeStats(mockUserId);

        expect(result).toEqual({
            totalCost: 245.5,
            totalLitres: 120.25,
            totalDistanceKm: 1800,
            logCount: 12,
        });
    });

    it('filters by vehicleId when provided', async () => {
        vi.mocked(getAggregateFromServer).mockResolvedValue({
            data: () => ({ totalCost: 50, totalLitres: 25, totalDistanceKm: 400, logCount: 2 }),
        } as never);

        await getLifetimeStats(mockUserId, 'vehicle-1');

        expect(where).toHaveBeenCalledWith('userId', '==', mockUserId);
        expect(where).toHaveBeenCalledWith('vehicleId', '==', 'vehicle-1');
    });

    it('does not filter by vehicleId when omitted', async () => {
        vi.mocked(getAggregateFromServer).mockResolvedValue({
            data: () => ({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 }),
        } as never);

        await getLifetimeStats(mockUserId);

        expect(where).toHaveBeenCalledWith('userId', '==', mockUserId);
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('defaults missing aggregate fields to zero rather than negative or undefined', async () => {
        vi.mocked(getAggregateFromServer).mockResolvedValue({
            data: () => ({}),
        } as never);

        const result = await getLifetimeStats(mockUserId);

        expect(result).toEqual({
            totalCost: 0,
            totalLitres: 0,
            totalDistanceKm: 0,
            logCount: 0,
        });
    });

    it('reflects a reduced count and totals after a log is deleted, never going negative', async () => {
        // Before deletion: 3 logs
        vi.mocked(getAggregateFromServer).mockResolvedValueOnce({
            data: () => ({ totalCost: 150, totalLitres: 75, totalDistanceKm: 900, logCount: 3 }),
        } as never);
        const before = await getLifetimeStats(mockUserId);
        expect(before.logCount).toBe(3);

        // After deleting one log: server-side aggregate recomputes from remaining logs
        vi.mocked(getAggregateFromServer).mockResolvedValueOnce({
            data: () => ({ totalCost: 100, totalLitres: 50, totalDistanceKm: 600, logCount: 2 }),
        } as never);
        const after = await getLifetimeStats(mockUserId);

        expect(after.logCount).toBe(2);
        expect(after.totalCost).toBeLessThan(before.totalCost);
        expect(after.logCount).toBeGreaterThanOrEqual(0);
        expect(after.totalCost).toBeGreaterThanOrEqual(0);
    });
});

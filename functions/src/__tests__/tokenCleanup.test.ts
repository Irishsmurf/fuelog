import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-functions/v2/scheduler so onSchedule returns the handler directly,
// allowing us to call and test it without deploying.
vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((_schedule: string, handler: () => Promise<void>) => handler),
}));

// Chainable Firestore mock
const mockCommit = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatch = { update: mockBatchUpdate, commit: mockCommit };

const mockGet = vi.fn();
const makeQuery = (): Record<string, unknown> => ({
    where: vi.fn(() => makeQuery()),
    get: mockGet,
});

const mockDb = {
    collection: vi.fn(() => makeQuery()),
    batch: vi.fn(() => mockBatch),
};

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => mockDb),
    Timestamp: { now: vi.fn(() => ({ seconds: 1000000 })) },
}));

// Import after mocks — cleanupExpiredTokens is the unwrapped handler
import { cleanupExpiredTokens } from '../tokenCleanup';

describe('cleanupExpiredTokens', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCommit.mockResolvedValue(undefined);
    });

    it('does nothing when no expired tokens exist', async () => {
        mockGet.mockResolvedValue({ empty: true, docs: [], size: 0 });

        await (cleanupExpiredTokens as unknown as () => Promise<void>)();

        expect(mockBatch.update).not.toHaveBeenCalled();
        expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('batch-updates expired tokens to isRevoked: true', async () => {
        const fakeDoc = { ref: { id: 'token1' } };
        mockGet.mockResolvedValue({ empty: false, docs: [fakeDoc], size: 1 });

        await (cleanupExpiredTokens as unknown as () => Promise<void>)();

        expect(mockBatch.update).toHaveBeenCalledWith(fakeDoc.ref, { isRevoked: true });
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('splits docs into batches of 500 when there are more than 500 expired tokens', async () => {
        const fakeDocs = Array.from({ length: 750 }, (_, i) => ({ ref: { id: `token${i}` } }));
        mockGet.mockResolvedValue({ empty: false, docs: fakeDocs, size: 750 });

        await (cleanupExpiredTokens as unknown as () => Promise<void>)();

        // 750 tokens → 2 batches (500 + 250)
        expect(mockBatch.commit).toHaveBeenCalledTimes(2);
        expect(mockBatch.update).toHaveBeenCalledTimes(750);
    });

    it('handles a batch of exactly 500 as a single batch', async () => {
        const fakeDocs = Array.from({ length: 500 }, (_, i) => ({ ref: { id: `token${i}` } }));
        mockGet.mockResolvedValue({ empty: false, docs: fakeDocs, size: 500 });

        await (cleanupExpiredTokens as unknown as () => Promise<void>)();

        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
});

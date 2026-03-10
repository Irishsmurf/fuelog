import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((_schedule: string, handler: () => Promise<void>) => handler),
}));

const mockSend = vi.fn();
vi.mock('firebase-admin/messaging', () => ({
    getMessaging: vi.fn(() => ({ send: mockSend })),
}));

const mockAggGet = vi.fn();
const mockProfileGet = vi.fn();
const mockFcmGet = vi.fn();

// Fully chainable query mock: .where() returns itself so any depth of chaining works
function makeChainableQuery() {
    const q: Record<string, unknown> = {};
    q.where = vi.fn(() => q);
    q.aggregate = vi.fn(() => ({ get: mockAggGet }));
    q.get = mockFcmGet;
    return q;
}

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn((col: string) => {
            if (col === 'userProfiles') {
                return { doc: vi.fn(() => ({ get: mockProfileGet })) };
            }
            return makeChainableQuery();
        }),
    })),
    AggregateField: {
        sum: vi.fn((f: string) => `sum(${f})`),
        count: vi.fn(() => 'count()'),
    },
    Timestamp: {
        fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
    },
}));

import { sendWeeklyDigest } from '../weeklyDigest';

const handler = sendWeeklyDigest as unknown as () => Promise<void>;

describe('sendWeeklyDigest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSend.mockResolvedValue('message-id');
    });

    it('does nothing when there are no FCM tokens', async () => {
        mockFcmGet.mockResolvedValue({ empty: true, docs: [] });

        await handler();

        expect(mockSend).not.toHaveBeenCalled();
    });

    it('skips users with no activity in the past 7 days', async () => {
        mockFcmGet.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ userId: 'user1', token: 'fcm-token-123' }) }],
        });
        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 0, totalSpent: 0, totalLitres: 0, totalKm: 0 }),
        });

        await handler();

        expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends a push notification for users with activity', async () => {
        mockFcmGet.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ userId: 'user1', token: 'fcm-token-abc' }) }],
        });
        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 3, totalSpent: 90.5, totalLitres: 60.0, totalKm: 400 }),
        });
        mockProfileGet.mockResolvedValue({
            exists: true,
            data: () => ({ homeCurrency: 'EUR' }),
        });

        await handler();

        expect(mockSend).toHaveBeenCalledOnce();
        const call = mockSend.mock.calls[0][0];
        expect(call.token).toBe('fcm-token-abc');
        expect(call.notification.title).toBe('⛽ Your weekly fuel summary');
        expect(call.notification.body).toContain('3 fill-ups');
        expect(call.notification.body).toContain('EUR 90.50');
    });

    it('defaults to EUR when no user profile exists', async () => {
        mockFcmGet.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ userId: 'user2', token: 'fcm-token-xyz' }) }],
        });
        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 1, totalSpent: 50, totalLitres: 30, totalKm: 200 }),
        });
        mockProfileGet.mockResolvedValue({ exists: false, data: () => null });

        await handler();

        const call = mockSend.mock.calls[0][0];
        expect(call.notification.body).toContain('EUR');
    });

    it('continues sending to other users if one send fails', async () => {
        mockFcmGet.mockResolvedValue({
            empty: false,
            docs: [
                { data: () => ({ userId: 'user1', token: 'token-a' }) },
                { data: () => ({ userId: 'user2', token: 'token-b' }) },
            ],
        });
        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 2, totalSpent: 40, totalLitres: 25, totalKm: 150 }),
        });
        mockProfileGet.mockResolvedValue({ exists: false, data: () => null });

        mockSend
            .mockRejectedValueOnce(new Error('token invalid'))
            .mockResolvedValueOnce('message-id');

        await expect(handler()).resolves.not.toThrow();
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});

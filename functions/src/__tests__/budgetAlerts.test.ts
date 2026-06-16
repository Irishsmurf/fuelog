import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldAlert } from '../budgetAlerts';

describe('shouldAlert (pure threshold logic)', () => {
    it('returns null when no budget is set', () => {
        expect(shouldAlert(100, undefined, [])).toBeNull();
        expect(shouldAlert(100, null, [])).toBeNull();
        expect(shouldAlert(100, 0, [])).toBeNull();
        expect(shouldAlert(100, -50, [])).toBeNull();
    });

    it('returns null when spend is below the lowest threshold', () => {
        expect(shouldAlert(50, 100, [])).toBeNull();
    });

    it('returns 80 the first time spend crosses 80%', () => {
        expect(shouldAlert(80, 100, [])).toBe(80);
        expect(shouldAlert(85, 100, [])).toBe(80);
    });

    it('does not re-alert 80 if already sent', () => {
        expect(shouldAlert(85, 100, [80])).toBeNull();
    });

    it('returns 100 once spend reaches the budget', () => {
        expect(shouldAlert(100, 100, [80])).toBe(100);
    });

    it('jumps straight to 100 if 80 was never sent but spend already exceeds 100%', () => {
        expect(shouldAlert(150, 100, [])).toBe(100);
    });

    it('returns null once both thresholds have been sent', () => {
        expect(shouldAlert(200, 100, [80, 100])).toBeNull();
    });
});

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentWritten: vi.fn((_path: string, handler: (event: unknown) => Promise<void>) => handler),
}));

const mockMessagingSend = vi.fn();
vi.mock('firebase-admin/messaging', () => ({
    getMessaging: vi.fn(() => ({ send: mockMessagingSend })),
}));

const { mockAggGet, mockProfileGet, mockFcmTokensGet, mockTxGet, mockTxSet, mockArrayUnion } = vi.hoisted(() => ({
    mockAggGet: vi.fn(),
    mockProfileGet: vi.fn(),
    mockFcmTokensGet: vi.fn(),
    mockTxGet: vi.fn(),
    mockTxSet: vi.fn(),
    mockArrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
}));

function makeChainableQuery() {
    const q: Record<string, unknown> = {};
    q.where = vi.fn(() => q);
    q.aggregate = vi.fn(() => ({ get: mockAggGet }));
    q.get = mockFcmTokensGet;
    q.doc = vi.fn(() => ({ get: mockTxGet }));
    return q;
}

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn((col: string) => {
            if (col === 'userProfiles') {
                return { doc: vi.fn(() => ({ get: mockProfileGet })) };
            }
            if (col === 'budgetAlerts') {
                return { doc: vi.fn(() => ({ get: mockTxGet })) };
            }
            return makeChainableQuery();
        }),
        runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ get: mockTxGet, set: mockTxSet })
        ),
    })),
    AggregateField: {
        sum: vi.fn((f: string) => `sum(${f})`),
    },
    Timestamp: {
        fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
        now: vi.fn(() => ({ toDate: () => new Date() })),
    },
    FieldValue: {
        arrayUnion: mockArrayUnion,
    },
}));

import { checkBudgetAlert } from '../budgetAlerts';

const handler = checkBudgetAlert as unknown as (event: unknown) => Promise<void>;

function makeEvent(afterData: Record<string, unknown> | undefined) {
    return {
        data: {
            after: { data: () => afterData },
        },
    };
}

function withinCurrentMonth(day = 15): { toDate: () => Date } {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    return { toDate: () => date } as never;
}

describe('checkBudgetAlert', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMessagingSend.mockResolvedValue('message-id');
    });

    it('does nothing when the document was deleted', async () => {
        await handler(makeEvent(undefined));
        expect(mockProfileGet).not.toHaveBeenCalled();
    });

    it('does nothing when the log is outside the current month', async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        await handler(makeEvent({ userId: 'user1', timestamp: { toDate: () => lastMonth } }));
        expect(mockProfileGet).not.toHaveBeenCalled();
    });

    it('does nothing when the user has no budget set (opt-in only)', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });

        await handler(makeEvent({ userId: 'user1', timestamp: withinCurrentMonth() }));

        expect(mockAggGet).not.toHaveBeenCalled();
        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('sends an alert when crossing the 80% threshold for the first time', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggGet.mockResolvedValue({ data: () => ({ totalSpent: 85 }) });
        mockTxGet.mockResolvedValue({ exists: false, data: () => undefined });
        mockFcmTokensGet.mockResolvedValue({ empty: false, docs: [{ data: () => ({ token: 'tok-1' }) }] });

        await handler(makeEvent({ userId: 'user1', timestamp: withinCurrentMonth() }));

        expect(mockTxSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ thresholds: { __arrayUnion: 80 } }),
            { merge: true }
        );
        expect(mockMessagingSend).toHaveBeenCalledOnce();
        const call = mockMessagingSend.mock.calls[0][0];
        expect(call.token).toBe('tok-1');
        expect(call.notification.body).toContain('85.00');
    });

    it('does not double-send the same threshold within a calendar month', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggGet.mockResolvedValue({ data: () => ({ totalSpent: 85 }) });
        mockTxGet.mockResolvedValue({ exists: true, data: () => ({ thresholds: [80] }) });

        await handler(makeEvent({ userId: 'user1', timestamp: withinCurrentMonth() }));

        expect(mockTxSet).not.toHaveBeenCalled();
        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('does not send when no FCM tokens are registered', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggGet.mockResolvedValue({ data: () => ({ totalSpent: 100 }) });
        mockTxGet.mockResolvedValue({ exists: false, data: () => undefined });
        mockFcmTokensGet.mockResolvedValue({ empty: true, docs: [] });

        await handler(makeEvent({ userId: 'user1', timestamp: withinCurrentMonth() }));

        expect(mockMessagingSend).not.toHaveBeenCalled();
    });
});

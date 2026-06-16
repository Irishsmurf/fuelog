import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldAlert, thresholdsToRollback } from '../budgetAlerts';

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

describe('thresholdsToRollback (pure rollback logic)', () => {
    it('returns all sent thresholds when there is no budget', () => {
        expect(thresholdsToRollback(50, undefined, [80, 100])).toEqual([80, 100]);
        expect(thresholdsToRollback(50, 0, [80])).toEqual([80]);
    });

    it('returns an empty array when spend still exceeds all sent thresholds', () => {
        expect(thresholdsToRollback(100, 100, [80, 100])).toEqual([]);
    });

    it('rolls back thresholds that spend has dropped back below', () => {
        // Spend dropped from over-budget to 70% — both 80 and 100 should roll back
        expect(thresholdsToRollback(70, 100, [80, 100])).toEqual([80, 100]);
    });

    it('only rolls back the threshold(s) no longer met', () => {
        // Spend dropped from 150% to 90% — 100 no longer holds, 80 still does
        expect(thresholdsToRollback(90, 100, [80, 100])).toEqual([100]);
    });
});

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentWritten: vi.fn((_path: string, handler: (event: unknown) => Promise<void>) => handler),
}));

const mockMessagingSend = vi.fn();
vi.mock('firebase-admin/messaging', () => ({
    getMessaging: vi.fn(() => ({ send: mockMessagingSend })),
}));

const { mockProfileGet, mockFcmTokensGet, mockAggSnap, mockAlertDocSnap, mockTxSet } = vi.hoisted(() => ({
    mockProfileGet: vi.fn(),
    mockFcmTokensGet: vi.fn(),
    mockAggSnap: vi.fn(),
    mockAlertDocSnap: vi.fn(),
    mockTxSet: vi.fn(),
}));

function makeChainableQuery() {
    const q: Record<string, unknown> = {};
    q.where = vi.fn(() => q);
    q.aggregate = vi.fn(() => ({ __isAggregateQuery: true }));
    q.get = mockFcmTokensGet;
    return q;
}

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn((col: string) => {
            if (col === 'userProfiles') {
                return { doc: vi.fn(() => ({ get: mockProfileGet })) };
            }
            if (col === 'budgetAlerts') {
                return { doc: vi.fn(() => ({ __isAlertDocRef: true })) };
            }
            return makeChainableQuery();
        }),
        runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({
                get: vi.fn((ref: { __isAggregateQuery?: boolean; __isAlertDocRef?: boolean }) =>
                    ref.__isAggregateQuery ? mockAggSnap() : mockAlertDocSnap()
                ),
                set: mockTxSet,
            })
        ),
    })),
    AggregateField: {
        sum: vi.fn((f: string) => `sum(${f})`),
    },
    Timestamp: {
        fromDate: vi.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
        now: vi.fn(() => ({ toDate: () => new Date() })),
    },
}));

import { checkBudgetAlert } from '../budgetAlerts';

const handler = checkBudgetAlert as unknown as (event: unknown) => Promise<void>;

function ts(date: Date) {
    return { toDate: () => date, toMillis: () => date.getTime() };
}

function withinCurrentMonth(day = 15) {
    const now = new Date();
    return ts(new Date(now.getFullYear(), now.getMonth(), day));
}

function makeEvent(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
    return {
        data: {
            before: { data: () => before },
            after: { data: () => after },
        },
    };
}

describe('checkBudgetAlert', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMessagingSend.mockResolvedValue('message-id');
    });

    it('does nothing when there is no userId on either side', async () => {
        await handler(makeEvent(undefined, undefined));
        expect(mockProfileGet).not.toHaveBeenCalled();
    });

    it('skips unrelated field edits where cost and timestamp are unchanged', async () => {
        const timestamp = withinCurrentMonth();
        await handler(makeEvent(
            { userId: 'user1', timestamp, cost: 50 },
            { userId: 'user1', timestamp, cost: 50, odometerKm: 12345 }
        ));
        expect(mockProfileGet).not.toHaveBeenCalled();
    });

    it('processes a create (no before doc) even though "changed" fields trivially differ', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });
        await handler(makeEvent(undefined, { userId: 'user1', timestamp: withinCurrentMonth(), cost: 50 }));
        expect(mockProfileGet).toHaveBeenCalled();
    });

    it('does nothing when the log is outside the current month', async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        await handler(makeEvent(undefined, { userId: 'user1', timestamp: ts(lastMonth), cost: 50 }));
        expect(mockProfileGet).not.toHaveBeenCalled();
    });

    it('does nothing when the user has no budget set (opt-in only)', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });

        await handler(makeEvent(undefined, { userId: 'user1', timestamp: withinCurrentMonth(), cost: 50 }));

        expect(mockAggSnap).not.toHaveBeenCalled();
        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('sends an alert when crossing the 80% threshold for the first time', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggSnap.mockReturnValue({ data: () => ({ totalSpent: 85 }) });
        mockAlertDocSnap.mockReturnValue({ exists: false, data: () => undefined });
        mockFcmTokensGet.mockResolvedValue({ empty: false, docs: [{ data: () => ({ token: 'tok-1' }) }] });

        await handler(makeEvent(undefined, { userId: 'user1', timestamp: withinCurrentMonth(), cost: 85 }));

        expect(mockTxSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ thresholds: [80] }),
            { merge: false }
        );
        expect(mockMessagingSend).toHaveBeenCalledOnce();
        const call = mockMessagingSend.mock.calls[0][0];
        expect(call.token).toBe('tok-1');
        expect(call.notification.body).toContain('85.00');
    });

    it('does not double-send the same threshold within a calendar month', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggSnap.mockReturnValue({ data: () => ({ totalSpent: 85 }) });
        mockAlertDocSnap.mockReturnValue({ exists: true, data: () => ({ thresholds: [80] }) });

        await handler(makeEvent(
            { userId: 'user1', timestamp: withinCurrentMonth(), cost: 80 },
            { userId: 'user1', timestamp: withinCurrentMonth(), cost: 85 }
        ));

        expect(mockTxSet).not.toHaveBeenCalled();
        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('does not send when no FCM tokens are registered', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggSnap.mockReturnValue({ data: () => ({ totalSpent: 100 }) });
        mockAlertDocSnap.mockReturnValue({ exists: false, data: () => undefined });
        mockFcmTokensGet.mockResolvedValue({ empty: true, docs: [] });

        await handler(makeEvent(undefined, { userId: 'user1', timestamp: withinCurrentMonth(), cost: 100 }));

        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('rolls back a threshold without sending a new alert when a log is deleted and spend drops', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        // After deletion, remaining spend is 70 (below the 80 that was previously sent)
        mockAggSnap.mockReturnValue({ data: () => ({ totalSpent: 70 }) });
        mockAlertDocSnap.mockReturnValue({ exists: true, data: () => ({ thresholds: [80] }) });

        await handler(makeEvent({ userId: 'user1', timestamp: withinCurrentMonth(), cost: 30 }, undefined));

        expect(mockTxSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ thresholds: [] }),
            { merge: false }
        );
        expect(mockMessagingSend).not.toHaveBeenCalled();
    });

    it('re-alerts after a rollback once spend crosses the threshold again later', async () => {
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR', monthlyBudget: 100 }) });
        mockAggSnap.mockReturnValue({ data: () => ({ totalSpent: 85 }) });
        mockAlertDocSnap.mockReturnValue({ exists: true, data: () => ({ thresholds: [] }) }); // rolled back previously
        mockFcmTokensGet.mockResolvedValue({ empty: false, docs: [{ data: () => ({ token: 'tok-1' }) }] });

        await handler(makeEvent(undefined, { userId: 'user1', timestamp: withinCurrentMonth(), cost: 85 }));

        expect(mockMessagingSend).toHaveBeenCalledOnce();
    });
});

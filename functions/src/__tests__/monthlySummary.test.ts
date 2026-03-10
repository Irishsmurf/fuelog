import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((_schedule: string, handler: () => Promise<void>) => handler),
}));

const mockAdd = vi.fn();
const mockAggGet = vi.fn();
const mockProfileGet = vi.fn();
const mockVehiclesGet = vi.fn();
const mockLogsSelectGet = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn((col: string) => {
            if (col === 'mail') return { add: mockAdd };
            if (col === 'userProfiles') return { doc: vi.fn(() => ({ get: mockProfileGet })) };
            if (col === 'vehicles') return makeChainWith(mockVehiclesGet);
            // fuelLogs — used for both select().get() and aggregate().get()
            const q = {
                where: vi.fn(() => q),
                select: vi.fn(() => ({ get: mockLogsSelectGet })),
                aggregate: vi.fn(() => ({ get: mockAggGet })),
                get: mockLogsSelectGet,
            };
            return q;
        }),
    })),
    AggregateField: {
        sum: vi.fn((f: string) => `sum(${f})`),
        count: vi.fn(() => 'count()'),
    },
    Timestamp: {
        now: vi.fn(() => ({ seconds: 9999999 })),
        fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
    },
}));

function makeChainWith(getter: ReturnType<typeof vi.fn>) {
    const q = { where: vi.fn(() => q), get: getter };
    return q;
}

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        getUser: vi.fn(async () => ({ email: 'test@example.com' })),
    })),
}));

import { sendMonthlySummary } from '../monthlySummary';

const handler = sendMonthlySummary as unknown as () => Promise<void>;

describe('sendMonthlySummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdd.mockResolvedValue({ id: 'mail-doc-1' });
    });

    it('does nothing when no users had logs last month', async () => {
        mockLogsSelectGet.mockResolvedValue({ docs: [] });

        await handler();

        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('queues an email for each user who had logs last month', async () => {
        mockLogsSelectGet.mockResolvedValue({
            docs: [
                { data: () => ({ userId: 'user1' }) },
                { data: () => ({ userId: 'user1' }) }, // duplicate — same user
                { data: () => ({ userId: 'user2' }) },
            ],
        });

        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 5, totalSpent: 120, totalLitres: 80, totalKm: 500 }),
        });
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });
        mockVehiclesGet.mockResolvedValue({ docs: [{ data: () => ({ name: 'My Golf', make: 'VW', model: 'Golf' }) }] });

        await handler();

        // 2 unique users → 2 emails queued
        expect(mockAdd).toHaveBeenCalledTimes(2);
        const mailDoc = mockAdd.mock.calls[0][0];
        expect(mailDoc.to).toBe('test@example.com');
        expect(mailDoc.message.subject).toMatch(/summary/i);
        expect(mailDoc.message.html).toContain('EUR');
        expect(mailDoc.message.html).toContain('120.00');
        expect(mailDoc.message.html).toContain('5'); // logCount
    });

    it('skips a user if they have 0 logs in the aggregate', async () => {
        mockLogsSelectGet.mockResolvedValue({
            docs: [{ data: () => ({ userId: 'user1' }) }],
        });

        mockAggGet.mockResolvedValue({
            data: () => ({ logCount: 0, totalSpent: 0, totalLitres: 0, totalKm: 0 }),
        });
        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });
        mockVehiclesGet.mockResolvedValue({ docs: [] });

        await handler();

        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('skips a user if their Auth record has no email', async () => {
        const { getAuth } = await import('firebase-admin/auth');
        vi.mocked(getAuth().getUser).mockResolvedValueOnce({ email: undefined } as never);

        mockLogsSelectGet.mockResolvedValue({
            docs: [{ data: () => ({ userId: 'user1' }) }],
        });

        await handler();

        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('continues processing other users if one fails', async () => {
        mockLogsSelectGet.mockResolvedValue({
            docs: [
                { data: () => ({ userId: 'user1' }) },
                { data: () => ({ userId: 'user2' }) },
            ],
        });

        mockAggGet
            .mockRejectedValueOnce(new Error('Firestore error'))
            .mockResolvedValue({
                data: () => ({ logCount: 3, totalSpent: 60, totalLitres: 40, totalKm: 300 }),
            });

        mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ homeCurrency: 'EUR' }) });
        mockVehiclesGet.mockResolvedValue({ docs: [] });

        await expect(handler()).resolves.not.toThrow();
        // user2 should still get an email
        expect(mockAdd).toHaveBeenCalledTimes(1);
    });
});

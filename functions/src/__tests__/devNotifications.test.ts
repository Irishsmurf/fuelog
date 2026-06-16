import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/https', async () => {
    class HttpsError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    }
    return {
        onCall: vi.fn((handler: (req: unknown) => unknown) => handler),
        HttpsError,
    };
});

const { mockParamValue } = vi.hoisted(() => ({ mockParamValue: vi.fn() }));
vi.mock('firebase-functions/params', () => ({
    defineString: vi.fn(() => ({ value: mockParamValue })),
}));

const mockMessagingSend = vi.fn();
vi.mock('firebase-admin/messaging', () => ({
    getMessaging: vi.fn(() => ({ send: mockMessagingSend })),
}));

const { mockTokensGet, mockTestNotificationsAdd } = vi.hoisted(() => ({
    mockTokensGet: vi.fn(),
    mockTestNotificationsAdd: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn((col: string) => {
            if (col === 'fcmTokens') {
                const q: Record<string, unknown> = {};
                q.where = vi.fn(() => q);
                q.get = mockTokensGet;
                return q;
            }
            if (col === 'testNotifications') {
                return { add: mockTestNotificationsAdd };
            }
            throw new Error(`Unexpected collection: ${col}`);
        }),
    })),
}));

import { sendTestNotification } from '../devNotifications';
import { HttpsError } from 'firebase-functions/v2/https';

const handler = sendTestNotification as unknown as (req: {
    auth?: { uid: string };
    data: { targetUid: string; title: string; body: string; data?: Record<string, string> };
}) => Promise<{ sentCount: number; failedCount: number }>;

describe('sendTestNotification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParamValue.mockReturnValue('dev-uid-1, dev-uid-2');
    });

    it('rejects unauthenticated requests', async () => {
        await expect(
            handler({ data: { targetUid: 'u1', title: 't', body: 'b' } })
        ).rejects.toThrow(HttpsError);
    });

    it('rejects callers not in the allowlist', async () => {
        await expect(
            handler({ auth: { uid: 'not-a-dev' }, data: { targetUid: 'u1', title: 't', body: 'b' } })
        ).rejects.toThrow(HttpsError);
    });

    it('rejects missing targetUid/title/body', async () => {
        await expect(
            handler({ auth: { uid: 'dev-uid-1' }, data: { targetUid: '', title: 't', body: 'b' } })
        ).rejects.toThrow(HttpsError);
    });

    it('throws not-found when the target user has no registered tokens', async () => {
        mockTokensGet.mockResolvedValue({ empty: true, docs: [] });
        await expect(
            handler({ auth: { uid: 'dev-uid-1' }, data: { targetUid: 'u1', title: 't', body: 'b' } })
        ).rejects.toThrow(HttpsError);
    });

    it('sends to all of the target user\'s tokens and logs an audit record', async () => {
        mockTokensGet.mockResolvedValue({
            empty: false,
            docs: [
                { data: () => ({ token: 'tok-1', userId: 'u1' }) },
                { data: () => ({ token: 'tok-2', userId: 'u1' }) },
            ],
        });
        mockMessagingSend.mockResolvedValue('message-id');

        const result = await handler({
            auth: { uid: 'dev-uid-1' },
            data: { targetUid: 'u1', title: 'Test', body: 'Hello', data: { foo: 'bar' } },
        });

        expect(result).toEqual({ sentCount: 2, failedCount: 0 });
        expect(mockMessagingSend).toHaveBeenCalledTimes(2);
        expect(mockMessagingSend).toHaveBeenCalledWith(
            expect.objectContaining({ token: 'tok-1', notification: { title: 'Test', body: 'Hello' }, data: { foo: 'bar' } })
        );
        expect(mockTestNotificationsAdd).toHaveBeenCalledWith(
            expect.objectContaining({ sentBy: 'dev-uid-1', targetUid: 'u1', sentCount: 2, failedCount: 0 })
        );
    });

    it('reports partial failures without throwing', async () => {
        mockTokensGet.mockResolvedValue({
            empty: false,
            docs: [
                { data: () => ({ token: 'tok-1', userId: 'u1' }) },
                { data: () => ({ token: 'tok-2', userId: 'u1' }) },
            ],
        });
        mockMessagingSend.mockResolvedValueOnce('message-id').mockRejectedValueOnce(new Error('invalid token'));

        const result = await handler({
            auth: { uid: 'dev-uid-1' },
            data: { targetUid: 'u1', title: 'Test', body: 'Hello' },
        });

        expect(result).toEqual({ sentCount: 1, failedCount: 1 });
    });
});

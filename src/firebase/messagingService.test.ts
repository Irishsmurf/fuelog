import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { isSupported } from 'firebase/analytics';

vi.mock('firebase/messaging', () => ({
    getMessaging: vi.fn(),
    getToken: vi.fn(),
    onMessage: vi.fn(),
}));

vi.mock('firebase/analytics', () => ({
    isSupported: vi.fn(),
}));

vi.mock('./config', () => ({
    app: {},
}));

const setNotificationPermission = (requestPermission: () => Promise<NotificationPermission>) => {
    Object.defineProperty(global, 'Notification', {
        value: { requestPermission },
        writable: true,
        configurable: true,
    });
};

describe('messagingService', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.mocked(isSupported).mockResolvedValue(true);
        vi.mocked(getMessaging).mockReturnValue({} as never);

        Object.defineProperty(window, 'PushManager', { value: {}, writable: true, configurable: true });
        Object.defineProperty(navigator, 'serviceWorker', {
            value: {
                getRegistration: vi.fn().mockResolvedValue(undefined),
                ready: Promise.resolve({ active: { postMessage: vi.fn() } }),
            },
            writable: true,
            configurable: true,
        });

        vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-vapid-key');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('requests a token from getToken when permission is granted', async () => {
        setNotificationPermission(() => Promise.resolve('granted'));
        vi.mocked(getToken).mockResolvedValue('mock-fcm-token');

        const { requestNotificationPermission } = await import('./messagingService');
        const token = await requestNotificationPermission();

        expect(getToken).toHaveBeenCalled();
        expect(token).toBe('mock-fcm-token');
    });

    it('returns null without throwing when permission is denied', async () => {
        setNotificationPermission(() => Promise.resolve('denied'));

        const { requestNotificationPermission } = await import('./messagingService');
        const token = await requestNotificationPermission();

        expect(token).toBeNull();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('returns null when messaging is unsupported in this environment', async () => {
        vi.mocked(isSupported).mockResolvedValue(false);
        setNotificationPermission(() => Promise.resolve('granted'));

        const { requestNotificationPermission } = await import('./messagingService');
        const token = await requestNotificationPermission();

        expect(token).toBeNull();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('returns null and does not throw when getToken rejects', async () => {
        setNotificationPermission(() => Promise.resolve('granted'));
        vi.mocked(getToken).mockRejectedValue(new Error('token fetch failed'));

        const { requestNotificationPermission } = await import('./messagingService');
        await expect(requestNotificationPermission()).resolves.toBeNull();
    });

    it('registers a foreground message handler via onMessage', async () => {
        const unsubscribe = vi.fn();
        vi.mocked(onMessage).mockReturnValue(unsubscribe);

        const { onForegroundMessage } = await import('./messagingService');
        const handler = vi.fn();
        const unsub = await onForegroundMessage(handler);

        expect(onMessage).toHaveBeenCalledWith({}, handler);
        expect(unsub).toBe(unsubscribe);
    });

    it('returns a no-op unsubscribe when messaging is unsupported', async () => {
        vi.mocked(isSupported).mockResolvedValue(false);

        const { onForegroundMessage } = await import('./messagingService');
        const unsub = await onForegroundMessage(vi.fn());

        expect(() => unsub()).not.toThrow();
        expect(onMessage).not.toHaveBeenCalled();
    });
});

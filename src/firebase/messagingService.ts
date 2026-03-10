// src/firebase/messagingService.ts
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';
import { isSupported } from 'firebase/analytics';
import { app } from './config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let _messaging: Messaging | null = null;

/**
 * Lazily initialises Firebase Messaging (only in supported environments).
 * Returns null in environments that don't support the Push API (e.g. Safari < 16, SSR).
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
    if (_messaging) return _messaging;
    const supported = await isSupported();
    if (!supported) return null;
    // Additional check: Push API must be available
    if (typeof window === 'undefined' || !('PushManager' in window)) return null;
    _messaging = getMessaging(app);
    // Send firebase config to the service worker so it can initialise Firebase there
    sendConfigToServiceWorker();
    return _messaging;
}

/**
 * Requests notification permission and returns the FCM registration token.
 * Returns null if permission is denied or messaging is unsupported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    if (!VAPID_KEY) {
        console.warn('VITE_FIREBASE_VAPID_KEY is not set — FCM token request will fail.');
        return null;
    }

    try {
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js'),
        });
        return token ?? null;
    } catch (err) {
        console.error('Failed to get FCM token:', err);
        return null;
    }
}

/**
 * Registers a foreground message handler. Returns an unsubscribe function.
 */
export async function onForegroundMessage(handler: (payload: MessagePayload) => void): Promise<() => void> {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => undefined;
    return onMessage(messaging, handler);
}

/**
 * Posts the Firebase app config to the service worker so it can initialise
 * Firebase Messaging for background message handling.
 */
function sendConfigToServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        registration.active?.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    });
}

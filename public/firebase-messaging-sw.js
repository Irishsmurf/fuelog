// public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker for background push notifications.
// This file must live at the root of the served directory (public/) so the browser
// can register it at the `/firebase-messaging-sw.js` scope.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Firebase config is injected at build time via a meta tag or hardcoded here.
// Using self.__WB_MANIFEST or self.firebaseConfig populated by the app.
// We use a self-registration approach: the app posts the config to the SW via postMessage.

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        const config = event.data.config;
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        const messaging = firebase.messaging();

        // Handle background messages
        messaging.onBackgroundMessage((payload) => {
            const { title, body, icon } = payload.notification ?? {};
            self.registration.showNotification(title ?? 'Fuelog', {
                body: body ?? '',
                icon: icon ?? '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                data: payload.data,
            });
        });
    }
});

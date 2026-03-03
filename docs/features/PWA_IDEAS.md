# Future PWA Feature Ideas

With the foundational PWA structure now in place (Service Workers, Manifest, Offline Caching), Fuelog can leverage advanced Web APIs to provide an even more "native" experience.

## 1. Background Sync (Workbox Sync)
- **Concept:** If a user logs a fuel entry while completely offline, the Service Worker "holds" the request and automatically retries it the moment the connection is restored, even if the app is closed.
- **Benefit:** Guarantees data integrity without the user needing to manually check sync status.
- **Complexity:** Low (native to Workbox).

## 2. Push Notifications
- **Concept:** Send notifications to the user's device for:
    - **Reminders:** "It's been 2 weeks since your last log, did you fill up?"
    - **Maintenance:** "Time for an oil change based on your estimated distance."
    - **Security:** "New login detected on your Fuelog account."
- **Benefit:** High engagement and utility.
- **Complexity:** Medium (Requires Firebase Cloud Messaging or a VAPID server).

## 3. Share Target API
- **Concept:** Register Fuelog as a "Share" destination on the OS. A user could take a photo of a fuel receipt and "Share to Fuelog".
- **Benefit:** Drastically reduces friction for data entry.
- **Complexity:** Medium (Requires manifest updates and a handling route).

## 4. App Badging API
- **Concept:** Show a numeric badge on the app icon (e.g., a "1" to indicate a pending maintenance task or a "!" for an offline log awaiting sync).
- **Benefit:** Subtle, native-feeling notification of state.
- **Complexity:** Low.

## 5. Periodic Background Sync
- **Concept:** Periodically wake up the service worker to fetch the latest exchange rates (from Frankfurter API) or update Remote Config.
- **Benefit:** Ensures that when the user opens the app, the data is already fresh even before the first network request.
- **Complexity:** Medium (Browser support varies).

## 6. Web Share API (Implemented for Reports)
- **Concept:** Allow users to share their generated PDF reports directly to WhatsApp, Email, or Drive using the native OS share sheet instead of just "downloading".
- **Benefit:** Modern, mobile-first workflow.
- **Complexity:** Low.

## 7. File System Access API
- **Concept:** For the Import/Export feature, allow users to pick a local folder that Fuelog can sync TSV files to automatically.
- **Benefit:** Advanced power-user feature for spreadsheet enthusiasts.
- **Complexity:** High.

## 8. Biometric Authentication (WebAuthn)
- **Concept:** Allow users to use FaceID or Fingerprint to unlock the app instead of full Google Sign-in every time the session expires.
- **Benefit:** High security with zero friction.
- **Complexity:** High.

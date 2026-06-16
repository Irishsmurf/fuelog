// functions/src/devNotifications.ts
//
// Callable function letting developers send an arbitrary FCM push to a
// specific user's registered device(s), for testing/debugging the
// notification pipeline without contriving real trigger conditions
// (crossing a budget threshold, waiting for the weekly digest cron, etc).
//
// Restricted to UIDs listed in the DEV_NOTIFICATION_UIDS deploy-time param —
// set via `firebase functions:secrets:set` or `firebase deploy --only
// functions --set-params` with a comma-separated list of developer UIDs.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const DEV_NOTIFICATION_UIDS = defineString('DEV_NOTIFICATION_UIDS', { default: '' });

interface SendTestNotificationRequest {
    targetUid: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

interface SendTestNotificationResponse {
    sentCount: number;
    failedCount: number;
}

function isAuthorizedDeveloper(uid: string): boolean {
    const allowedUids = DEV_NOTIFICATION_UIDS.value()
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);
    return allowedUids.includes(uid);
}

/**
 * Lets the client check whether the signed-in user is allowed to use the
 * dev notification tools, so the Admin Console page can gate itself without
 * exposing the allowlist contents.
 */
export const checkDeveloperAccess = onCall<unknown, Promise<{ isDeveloper: boolean }>>(async (request) => {
    if (!request.auth) {
        return { isDeveloper: false };
    }
    return { isDeveloper: isAuthorizedDeveloper(request.auth.uid) };
});

export const sendTestNotification = onCall<SendTestNotificationRequest, Promise<SendTestNotificationResponse>>(
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be signed in.');
        }
        if (!isAuthorizedDeveloper(request.auth.uid)) {
            throw new HttpsError('permission-denied', 'Not authorized to send test notifications.');
        }

        const { targetUid, title, body, data } = request.data;
        if (!targetUid || typeof targetUid !== 'string') {
            throw new HttpsError('invalid-argument', 'targetUid is required.');
        }
        if (!title || typeof title !== 'string' || !body || typeof body !== 'string') {
            throw new HttpsError('invalid-argument', 'title and body are required.');
        }

        const db = getFirestore();
        const messaging = getMessaging();

        const tokensSnap = await db.collection('fcmTokens').where('userId', '==', targetUid).get();
        if (tokensSnap.empty) {
            throw new HttpsError('not-found', `No registered FCM tokens for uid ${targetUid}.`);
        }

        const results = await Promise.allSettled(
            tokensSnap.docs.map(tokenDoc =>
                messaging.send({
                    token: tokenDoc.data().token as string,
                    notification: { title, body },
                    data,
                    webpush: {
                        notification: {
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/icon-72x72.png',
                        },
                    },
                })
            )
        );

        const sentCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.length - sentCount;

        await db.collection('testNotifications').add({
            sentBy: request.auth.uid,
            targetUid,
            title,
            body,
            data: data ?? null,
            sentCount,
            failedCount,
            createdAt: new Date(),
        });

        return { sentCount, failedCount };
    }
);

// functions/src/budgetAlerts.ts
//
// Firestore trigger: fires whenever a fuelLogs document is created/updated/deleted.
// If the log falls in the current calendar month and the user has an opt-in
// monthly budget set, checks cumulative spend for the month against the
// budget and sends an FCM push notification the first time 80% and 100%
// thresholds are crossed. Idempotency is tracked per user per calendar month
// in the `budgetAlerts` collection.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, AggregateField, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const ALERT_THRESHOLDS = [80, 100] as const;
export type AlertThreshold = typeof ALERT_THRESHOLDS[number];

/**
 * Pure function: given current spend, a monthly budget, and the thresholds
 * already alerted this month, returns the highest newly-crossed threshold
 * (so a sudden jump from 0% to 150% alerts at 100%, not 80%), or null if
 * no new alert should fire.
 */
export function shouldAlert(
    spent: number,
    budget: number | null | undefined,
    alertsSent: number[]
): AlertThreshold | null {
    if (!budget || budget <= 0) return null;
    const pct = (spent / budget) * 100;

    for (const threshold of [...ALERT_THRESHOLDS].sort((a, b) => b - a)) {
        if (pct >= threshold && !alertsSent.includes(threshold)) {
            return threshold;
        }
    }
    return null;
}

function currentMonthRange(): { start: Timestamp; end: Timestamp; monthKey: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end), monthKey };
}

export const checkBudgetAlert = onDocumentWritten('fuelLogs/{logId}', async (event) => {
    const afterData = event.data?.after.data();
    if (!afterData) return; // Document deleted — nothing to alert on.

    const userId = afterData.userId as string | undefined;
    const timestamp = afterData.timestamp as Timestamp | undefined;
    if (!userId || !timestamp) return;

    const { start, end, monthKey } = currentMonthRange();

    // Only logs in the current calendar month can affect this month's budget status.
    if (timestamp.toDate() < start.toDate() || timestamp.toDate() >= end.toDate()) return;

    const db = getFirestore();

    const profileDoc = await db.collection('userProfiles').doc(userId).get();
    const monthlyBudget = profileDoc.exists ? (profileDoc.data()?.monthlyBudget as number | undefined) : undefined;
    if (!monthlyBudget || monthlyBudget <= 0) return; // Opt-in only.

    const aggSnap = await db
        .collection('fuelLogs')
        .where('userId', '==', userId)
        .where('timestamp', '>=', start)
        .where('timestamp', '<', end)
        .aggregate({ totalSpent: AggregateField.sum('cost') })
        .get();
    const spent = aggSnap.data().totalSpent ?? 0;

    const alertDocRef = db.collection('budgetAlerts').doc(`${userId}_${monthKey}`);

    // Transaction avoids double-sending if two log writes race past the threshold check
    // at nearly the same time.
    const thresholdToAlert = await db.runTransaction(async (tx) => {
        const alertDoc = await tx.get(alertDocRef);
        const alertsSent: number[] = alertDoc.exists ? (alertDoc.data()?.thresholds ?? []) : [];

        const threshold = shouldAlert(spent, monthlyBudget, alertsSent);
        if (threshold === null) return null;

        tx.set(alertDocRef, {
            userId,
            monthKey,
            thresholds: FieldValue.arrayUnion(threshold),
            updatedAt: Timestamp.now(),
        }, { merge: true });

        return threshold;
    });

    if (thresholdToAlert === null) return;

    const tokensSnap = await db.collection('fcmTokens').where('userId', '==', userId).get();
    if (tokensSnap.empty) return;

    const homeCurrency: string = profileDoc.data()?.homeCurrency ?? 'EUR';
    const title = thresholdToAlert >= 100
        ? '⚠️ Monthly fuel budget exceeded'
        : '⛽ Approaching your fuel budget';
    const body = `You've spent ${homeCurrency} ${spent.toFixed(2)} of your ${homeCurrency} ${monthlyBudget.toFixed(2)} budget (${thresholdToAlert}%+) this month.`;

    const results = await Promise.allSettled(
        tokensSnap.docs.map((tokenDoc) => {
            const { token } = tokenDoc.data() as { token: string };
            return getMessaging().send({
                token,
                notification: { title, body },
                webpush: {
                    notification: {
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-72x72.png',
                    },
                    fcmOptions: { link: 'https://fuelog.app/profile' },
                },
            });
        })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`${failed.length} budget alert(s) failed to send for userId ${userId}.`);
    }
});

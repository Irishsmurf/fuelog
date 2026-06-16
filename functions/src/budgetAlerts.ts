// functions/src/budgetAlerts.ts
//
// Firestore trigger: fires whenever a fuelLogs document is created, updated,
// or deleted. If the write could change the current month's spend total for
// the user (cost or timestamp changed, or the doc was created/deleted) and
// the user has an opt-in monthly budget set, checks cumulative spend for the
// month against the budget and sends an FCM push notification the first
// time 80% and 100% thresholds are crossed. Idempotency — and rollback, if a
// later edit/deletion drops spend back below a previously-crossed threshold
// — is tracked per user per calendar month in the `budgetAlerts` collection.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, AggregateField, Timestamp } from 'firebase-admin/firestore';
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

/**
 * Pure function: given current spend, a monthly budget, and the thresholds
 * previously recorded as sent, returns the subset that no longer apply
 * (spend has dropped back below them, e.g. after a log edit/deletion) so
 * they can be un-recorded and re-alerted if crossed again later.
 */
export function thresholdsToRollback(
    spent: number,
    budget: number | null | undefined,
    alertsSent: number[]
): number[] {
    if (!budget || budget <= 0) return alertsSent;
    const pct = (spent / budget) * 100;
    return alertsSent.filter(t => pct < t);
}

function currentMonthRange(): { start: Timestamp; end: Timestamp; monthKey: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end), monthKey };
}

interface LogFields {
    userId?: string;
    timestamp?: Timestamp;
    cost?: number;
}

export const checkBudgetAlert = onDocumentWritten('fuelLogs/{logId}', async (event) => {
    const beforeData = event.data?.before.data() as LogFields | undefined;
    const afterData = event.data?.after.data() as LogFields | undefined;

    const userId = afterData?.userId ?? beforeData?.userId;
    if (!userId) return;

    // Skip writes that can't possibly change a monthly spend total — e.g. a
    // receipt thumbnail or odometer-only edit. Avoids running an aggregate
    // query + transaction on every unrelated field edit.
    const costChanged = beforeData?.cost !== afterData?.cost;
    const timestampChanged = beforeData?.timestamp?.toMillis() !== afterData?.timestamp?.toMillis();
    const created = !beforeData;
    const deleted = !afterData;
    if (!created && !deleted && !costChanged && !timestampChanged) return;

    // Either the before or after timestamp could land in the current month
    // (e.g. a log retimestamped out of this month, or deleted from it).
    const relevantTimestamp = afterData?.timestamp ?? beforeData?.timestamp;
    if (!relevantTimestamp) return;

    const { start, end, monthKey } = currentMonthRange();
    if (relevantTimestamp.toDate() < start.toDate() || relevantTimestamp.toDate() >= end.toDate()) return;

    const db = getFirestore();

    const profileDoc = await db.collection('userProfiles').doc(userId).get();
    const monthlyBudget = profileDoc.exists ? (profileDoc.data()?.monthlyBudget as number | undefined) : undefined;
    if (!monthlyBudget || monthlyBudget <= 0) return; // Opt-in only.

    const spendQuery = db
        .collection('fuelLogs')
        .where('userId', '==', userId)
        .where('timestamp', '>=', start)
        .where('timestamp', '<', end)
        .aggregate({ totalSpent: AggregateField.sum('cost') });

    const alertDocRef = db.collection('budgetAlerts').doc(`${userId}_${monthKey}`);

    // Both the spend total and the idempotency doc are read inside the same
    // transaction, so a concurrent log write can't be evaluated against a
    // stale spend figure (which could otherwise miss/mis-rank an alert).
    const result = await db.runTransaction(async (tx) => {
        const [aggSnap, alertDoc] = await Promise.all([tx.get(spendQuery), tx.get(alertDocRef)]);
        const spent = aggSnap.data().totalSpent ?? 0;
        const alertsSent: number[] = alertDoc.exists ? (alertDoc.data()?.thresholds ?? []) : [];

        const rollback = thresholdsToRollback(spent, monthlyBudget, alertsSent);
        const threshold = shouldAlert(spent, monthlyBudget, alertsSent);

        if (threshold === null && rollback.length === 0) return { spent, threshold: null };

        const remaining = alertsSent.filter(t => !rollback.includes(t));
        tx.set(alertDocRef, {
            userId,
            monthKey,
            thresholds: threshold !== null ? [...remaining, threshold] : remaining,
            updatedAt: Timestamp.now(),
        }, { merge: false });

        return { spent, threshold };
    });

    if (result.threshold === null) return;

    const tokensSnap = await db.collection('fcmTokens').where('userId', '==', userId).get();
    if (tokensSnap.empty) return;

    const homeCurrency: string = profileDoc.data()?.homeCurrency ?? 'EUR';
    const title = result.threshold >= 100
        ? '⚠️ Monthly fuel budget exceeded'
        : '⛽ Approaching your fuel budget';
    const body = `You've spent ${homeCurrency} ${result.spent.toFixed(2)} of your ${homeCurrency} ${monthlyBudget.toFixed(2)} budget (${result.threshold}%+) this month.`;

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

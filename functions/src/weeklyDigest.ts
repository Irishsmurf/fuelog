// functions/src/weeklyDigest.ts
//
// Sends a weekly fuel cost digest push notification every Monday at 08:00 UTC.
// Reads FCM tokens from the `fcmTokens` collection and sends personalised stats
// for the past 7 days via Firebase Cloud Messaging.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, AggregateField, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function sevenDaysAgo(): Timestamp {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return Timestamp.fromDate(d);
}

export const sendWeeklyDigest = onSchedule('every monday 08:00', async () => {
    const db = getFirestore();
    const messaging = getMessaging();
    const since = sevenDaysAgo();

    // Fetch all registered FCM tokens
    const tokensSnap = await db.collection('fcmTokens').get();
    if (tokensSnap.empty) {
        console.log('No FCM tokens registered — nothing to send.');
        return;
    }

    const results = await Promise.allSettled(
        tokensSnap.docs.map(async (tokenDoc) => {
            const { userId, token } = tokenDoc.data() as { userId: string; token: string };

            // Aggregate stats for the past 7 days
            const aggSnap = await db
                .collection('fuelLogs')
                .where('userId', '==', userId)
                .where('timestamp', '>=', since)
                .aggregate({
                    totalSpent: AggregateField.sum('cost'),
                    totalLitres: AggregateField.sum('fuelAmountLiters'),
                    totalKm: AggregateField.sum('distanceKm'),
                    logCount: AggregateField.count(),
                })
                .get();

            const agg = aggSnap.data();
            const logCount = agg.logCount ?? 0;

            // Skip if no activity this week
            if (logCount === 0) return;

            const profileDoc = await db.collection('userProfiles').doc(userId).get();
            const homeCurrency: string = profileDoc.exists ? (profileDoc.data()?.homeCurrency ?? 'EUR') : 'EUR';

            const totalSpent = agg.totalSpent ?? 0;
            const totalLitres = agg.totalLitres ?? 0;
            const avgCostPerL = totalLitres > 0 ? (totalSpent / totalLitres).toFixed(3) : null;

            const body = avgCostPerL
                ? `${logCount} fill-up${logCount > 1 ? 's' : ''} · ${homeCurrency} ${totalSpent.toFixed(2)} spent · ${homeCurrency} ${avgCostPerL}/L avg`
                : `${logCount} fill-up${logCount > 1 ? 's' : ''} · ${homeCurrency} ${totalSpent.toFixed(2)} spent`;

            await messaging.send({
                token,
                notification: {
                    title: '⛽ Your weekly fuel summary',
                    body,
                },
                webpush: {
                    notification: {
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-72x72.png',
                    },
                    fcmOptions: { link: 'https://fuelog.app/history' },
                },
            });

            console.log(`Sent weekly digest to userId ${userId}`);
        })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`${failed.length} weekly digest(s) failed to send.`);
    }
});

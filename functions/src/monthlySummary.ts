// functions/src/monthlySummary.ts
//
// Monthly fuel summary email — runs on the 1st of each month at 08:00 UTC.
//
// Prerequisites:
//   1. Install the Firebase "Trigger Email" extension in the Firebase Console:
//      firebase ext:install firebase/firestore-send-email
//   2. Configure the extension to use a `mail` collection and your SMTP credentials.
//
// The function writes a document to the `mail` collection; the extension handles delivery.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, AggregateField, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

interface VehicleData {
    name: string;
    make: string;
    model: string;
}

/**
 * Returns the start and end Timestamps for the previous calendar month.
 */
function previousMonthRange(): { start: Timestamp; end: Timestamp; label: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const label = start.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end), label };
}

export const sendMonthlySummary = onSchedule('0 8 1 * *', async () => {
    const db = getFirestore();
    const auth = getAuth();
    const { start, end, label } = previousMonthRange();

    // Find all unique userIds that have logs in the previous month
    const logsSnap = await db
        .collection('fuelLogs')
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .select('userId')
        .get();

    const userIds = [...new Set(logsSnap.docs.map(d => d.data().userId as string))];
    console.log(`Monthly summary: ${userIds.length} user(s) to notify for ${label}.`);

    for (const userId of userIds) {
        try {
            // Fetch user email from Firebase Auth
            const userRecord = await auth.getUser(userId);
            const email = userRecord.email;
            if (!email) continue;

            // Fetch user profile for home currency
            const profileDoc = await db.collection('userProfiles').doc(userId).get();
            const homeCurrency: string = profileDoc.exists ? (profileDoc.data()?.homeCurrency ?? 'EUR') : 'EUR';

            // Aggregate stats for the month
            const aggSnap = await db
                .collection('fuelLogs')
                .where('userId', '==', userId)
                .where('timestamp', '>=', start)
                .where('timestamp', '<=', end)
                .aggregate({
                    totalSpent: AggregateField.sum('cost'),
                    totalLitres: AggregateField.sum('fuelAmountLiters'),
                    totalKm: AggregateField.sum('distanceKm'),
                    logCount: AggregateField.count(),
                })
                .get();

            const agg = aggSnap.data();
            const totalSpent = agg.totalSpent ?? 0;
            const totalLitres = agg.totalLitres ?? 0;
            const totalKm = agg.totalKm ?? 0;
            const logCount = agg.logCount ?? 0;

            if (logCount === 0) continue;

            const avgCostPerL = totalLitres > 0 ? (totalSpent / totalLitres).toFixed(3) : 'N/A';
            const avgMpg = totalLitres > 0
                ? ((totalKm / totalLitres) * 2.824858).toFixed(1) // L to mpg UK
                : 'N/A';

            // Fetch vehicle names for context
            const vehiclesSnap = await db
                .collection('vehicles')
                .where('userId', '==', userId)
                .where('isArchived', '==', false)
                .get();
            const vehicleNames = vehiclesSnap.docs
                .map(d => {
                    const v = d.data() as VehicleData;
                    return v.name || `${v.make} ${v.model}`;
                })
                .join(', ');

            const subject = `Your Fuelog summary for ${label}`;
            const html = `
<h2>⛽ Your fuel summary for ${label}</h2>
<table style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
  <tr><td style="padding:6px 12px; color:#555;">Fill-ups</td><td style="padding:6px 12px; font-weight:bold;">${logCount}</td></tr>
  <tr><td style="padding:6px 12px; color:#555;">Total spent</td><td style="padding:6px 12px; font-weight:bold;">${homeCurrency} ${totalSpent.toFixed(2)}</td></tr>
  <tr><td style="padding:6px 12px; color:#555;">Total fuel</td><td style="padding:6px 12px; font-weight:bold;">${totalLitres.toFixed(1)} L</td></tr>
  <tr><td style="padding:6px 12px; color:#555;">Total distance</td><td style="padding:6px 12px; font-weight:bold;">${totalKm.toFixed(0)} km</td></tr>
  <tr><td style="padding:6px 12px; color:#555;">Avg cost/litre</td><td style="padding:6px 12px; font-weight:bold;">${homeCurrency} ${avgCostPerL}</td></tr>
  <tr><td style="padding:6px 12px; color:#555;">Avg efficiency</td><td style="padding:6px 12px; font-weight:bold;">${avgMpg} MPG</td></tr>
  ${vehicleNames ? `<tr><td style="padding:6px 12px; color:#555;">Vehicle(s)</td><td style="padding:6px 12px;">${vehicleNames}</td></tr>` : ''}
</table>
<p style="margin-top:16px; font-size:12px; color:#999;">
  You're receiving this because you have a Fuelog account.
  <a href="https://fuelog.app">Open Fuelog</a>
</p>
`;

            // Write to `mail` collection — consumed by the Firebase Trigger Email extension
            await db.collection('mail').add({
                to: email,
                message: { subject, html },
                createdAt: Timestamp.now(),
            });

            console.log(`Queued monthly summary for ${email}`);
        } catch (err) {
            console.error(`Failed to send summary for userId ${userId}:`, err);
        }
    }
});

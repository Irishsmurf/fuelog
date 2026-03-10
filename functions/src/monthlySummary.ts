import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, AggregateField, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

const EMAIL_TEMPLATE = readFileSync(join(__dirname, 'templates/monthlySummary.html'), 'utf8');

function renderTemplate(vars: Record<string, string>): string {
    let html = EMAIL_TEMPLATE;
    for (const [key, value] of Object.entries(vars)) {
        html = html.split(`{{${key}}}`).join(value);
    }
    // Strip conditional blocks — {{#if x}}...{{/if}} shown only when var is non-empty
    html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) =>
        vars[key] ? content : '',
    );
    return html;
}

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

/**
 * Monthly fuel summary email — runs on the 1st of each month at 08:00 UTC.
 *
 * This function writes a document to the `mail` collection, which is then
 * processed and sent by the Firebase "Trigger Email" extension.
 *
 * Prerequisites:
 * 1. Install the "Trigger Email" extension: firebase ext:install firebase/firestore-send-email
 * 2. Configure the extension to use a `mail` collection and your SMTP credentials.
 */
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
            const html = renderTemplate({
                label,
                logCount: String(logCount),
                homeCurrency,
                totalSpent: totalSpent.toFixed(2),
                totalLitres: totalLitres.toFixed(1),
                totalKm: totalKm.toFixed(0),
                avgCostPerL,
                avgMpg,
                vehicleNames,
            });

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

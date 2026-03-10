// functions/src/tokenCleanup.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Scheduled function that runs every 24 hours to revoke expired API tokens.
 * Queries apiTokens where expiresAt < now AND isRevoked == false, then batch-updates them.
 */
export const cleanupExpiredTokens = onSchedule('every 24 hours', async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    const expiredSnap = await db
        .collection('apiTokens')
        .where('isRevoked', '==', false)
        .where('expiresAt', '<', now)
        .get();

    if (expiredSnap.empty) {
        console.log('No expired tokens to clean up.');
        return;
    }

    // Batch-update in chunks of 500 (Firestore batch limit)
    const chunks: typeof expiredSnap.docs[] = [];
    for (let i = 0; i < expiredSnap.docs.length; i += 500) {
        chunks.push(expiredSnap.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        for (const docSnap of chunk) {
            batch.update(docSnap.ref, { isRevoked: true });
        }
        await batch.commit();
    }

    console.log(`Revoked ${expiredSnap.size} expired API token(s).`);
});

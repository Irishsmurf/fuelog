import type { Firestore } from 'firebase-admin/firestore';

/** Default number of receipt extractions a user may run per UTC day. */
export const DEFAULT_RECEIPT_DAILY_LIMIT = 50;

export function receiptDailyLimit(): number {
  const n = Number(process.env.RECEIPT_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RECEIPT_DAILY_LIMIT;
}

/**
 * Atomically consumes one unit of a user's daily quota for `kind`.
 * Returns false (and consumes nothing) once the limit is reached.
 * Counters live in the server-only `usageQuotas` collection, which the
 * Firestore rules deny to clients by default.
 */
export async function consumeDailyQuota(
  db: Firestore,
  uid: string,
  kind: string,
  limit: number,
  now: Date = new Date(),
): Promise<boolean> {
  const day = now.toISOString().slice(0, 10);
  const ref = db.collection('usageQuotas').doc(`${uid}_${kind}_${day}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    if (used >= limit) return false;
    tx.set(ref, { uid, kind, day, count: used + 1, updatedAt: now }, { merge: true });
    return true;
  });
}

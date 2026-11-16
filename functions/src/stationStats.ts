// functions/src/stationStats.ts
//
// Server-owned station price statistics. Fires on every fuelLogs write and
// moves the log's price contribution between stations/currencies:
// removes what the old version contributed, adds what the new version does.
//
// Stats are kept per currency (`priceStats.<CUR>`), keyed by the log owner's
// home currency (`cost` is stored in home currency), so averages no longer
// mix EUR and GBP prices the way the old client-maintained `avgPrice` did.
//
// Triggers can be delivered more than once; each event is applied at most
// once by recording its id in `triggerEvents` inside the same transaction.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

export interface PriceContribution {
    stationId: string;
    currency: string;
    pricePerLitre: number;
    at: number; // ms since epoch of the fill-up
}

export interface CurrencyStats {
    count: number;
    total: number;      // sum of price-per-litre values, for the running mean
    avgPrice: number;
    lastPrice: number | null;
    lastAt: number | null;
}

export type PriceStats = Record<string, CurrencyStats>;

interface LogFields {
    userId?: string;
    stationId?: string;
    cost?: number;
    fuelAmountLiters?: number;
    timestamp?: { toMillis(): number };
}

const MAX_PLAUSIBLE_PRICE = 100000; // per litre, in any currency

/** What a single log contributes to station stats, or null if nothing. */
export function contributionOf(log: LogFields | undefined, homeCurrency: string | undefined): PriceContribution | null {
    if (!log?.stationId || !homeCurrency) return null;
    const { cost, fuelAmountLiters } = log;
    if (typeof cost !== 'number' || typeof fuelAmountLiters !== 'number') return null;
    if (!(cost > 0) || !(fuelAmountLiters > 0)) return null;
    const pricePerLitre = cost / fuelAmountLiters;
    if (!Number.isFinite(pricePerLitre) || pricePerLitre >= MAX_PLAUSIBLE_PRICE) return null;
    return { stationId: log.stationId, currency: homeCurrency, pricePerLitre, at: log.timestamp?.toMillis() ?? 0 };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Applies a removal and/or an addition to one station's stats (pure). */
export function applyContribution(
    stats: PriceStats,
    remove: PriceContribution | null,
    add: PriceContribution | null,
): PriceStats {
    const next: PriceStats = { ...stats };
    if (remove) {
        const cur = next[remove.currency];
        if (cur && cur.count > 0) {
            const count = cur.count - 1;
            const total = count === 0 ? 0 : round(cur.total - remove.pricePerLitre);
            next[remove.currency] = {
                ...cur,
                count,
                total,
                avgPrice: count === 0 ? 0 : round(total / count),
                ...(count === 0 && { lastPrice: null, lastAt: null }),
            };
        }
    }
    if (add) {
        const cur = next[add.currency] ?? { count: 0, total: 0, avgPrice: 0, lastPrice: null, lastAt: null };
        const count = cur.count + 1;
        const total = round(cur.total + add.pricePerLitre);
        const isLatest = cur.lastAt === null || add.at >= cur.lastAt;
        next[add.currency] = {
            count,
            total,
            avgPrice: round(total / count),
            lastPrice: isLatest ? add.pricePerLitre : cur.lastPrice,
            lastAt: isLatest ? add.at : cur.lastAt,
        };
    }
    return next;
}

const sameContribution = (a: PriceContribution | null, b: PriceContribution | null) =>
    a?.stationId === b?.stationId && a?.currency === b?.currency &&
    a?.pricePerLitre === b?.pricePerLitre && a?.at === b?.at;

async function homeCurrencyOf(db: Firestore, userId: string | undefined): Promise<string | undefined> {
    if (!userId) return undefined;
    const snap = await db.collection('userProfiles').doc(userId).get();
    return (snap.data()?.homeCurrency as string | undefined) ?? 'EUR';
}

/**
 * Applies one log write to station stats. Exported for tests; `eventId`
 * makes it idempotent across redelivery.
 */
export async function handleLogWrite(
    db: Firestore,
    eventId: string,
    before: LogFields | undefined,
    after: LogFields | undefined,
): Promise<'skipped' | 'duplicate' | 'applied'> {
    if (!before?.stationId && !after?.stationId) return 'skipped';

    const userId = after?.userId ?? before?.userId;
    const home = await homeCurrencyOf(db, userId);
    const removed = contributionOf(before, home);
    const added = contributionOf(after, home);
    if (sameContribution(removed, added)) return 'skipped';

    const marker = db.collection('triggerEvents').doc(`stationStats_${eventId}`);
    return db.runTransaction(async (tx) => {
        if ((await tx.get(marker)).exists) return 'duplicate' as const;

        const ids = [...new Set([removed?.stationId, added?.stationId].filter((x): x is string => !!x))];
        const refs = ids.map(id => db.collection('stations').doc(id));
        const snaps = await Promise.all(refs.map(r => tx.get(r)));

        snaps.forEach((snap, i) => {
            if (!snap.exists) return; // Station was never created; nothing to aggregate onto.
            const id = ids[i];
            const stats = applyContribution(
                (snap.data()?.priceStats as PriceStats | undefined) ?? {},
                removed?.stationId === id ? removed : null,
                added?.stationId === id ? added : null,
            );
            tx.update(refs[i], { priceStats: stats, statsUpdatedAt: Timestamp.now() });
        });

        // expireAt lets a Firestore TTL policy prune old markers.
        tx.set(marker, { createdAt: Timestamp.now(), expireAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000) });
        return 'applied' as const;
    });
}

export type StatsLog = LogFields;

/** Pure planner for a full rebuild: station id → priceStats. */
export function planStationStats(
    logs: StatsLog[],
    homeCurrencyByUser: Map<string, string>,
): Map<string, PriceStats> {
    const out = new Map<string, PriceStats>();
    for (const log of logs) {
        const c = contributionOf(log, log.userId ? homeCurrencyByUser.get(log.userId) ?? 'EUR' : undefined);
        if (!c) continue;
        out.set(c.stationId, applyContribution(out.get(c.stationId) ?? {}, null, c));
    }
    return out;
}

/**
 * Recomputes priceStats for every station from all logs. Replaces priceStats
 * wholesale, so it is safe to re-run. Returns the number of stations written.
 */
export async function rebuildAllStationStats(db: Firestore, apply: boolean, log: (msg: string) => void = () => {}): Promise<number> {
    const [logsSnap, profilesSnap, stationsSnap] = await Promise.all([
        db.collection('fuelLogs').where('stationId', '!=', null).get(),
        db.collection('userProfiles').get(),
        db.collection('stations').get(),
    ]);
    const homes = new Map(profilesSnap.docs.map((d) => [d.id, (d.data().homeCurrency as string) ?? 'EUR']));
    const plan = planStationStats(logsSnap.docs.map((d) => d.data() as StatsLog), homes);
    log(`Logs with a station: ${logsSnap.size}; stations: ${stationsSnap.size}; stations with stats: ${plan.size}`);

    let batch = db.batch();
    let pending = 0;
    let written = 0;
    for (const station of stationsSnap.docs) {
        const stats = plan.get(station.id) ?? {};
        const summary = Object.entries(stats).map(([cur, s]) => `${cur} n=${s.count} avg=${s.avgPrice.toFixed(3)}`).join(', ') || '(none)';
        log(`  ${station.id}: ${summary}  [legacy avgPrice=${station.data().avgPrice ?? '-'} logCount=${station.data().logCount ?? '-'}]`);
        if (!apply) continue;
        batch.update(station.ref, { priceStats: stats, statsUpdatedAt: Timestamp.now() });
        if (++pending === 400) { await batch.commit(); written += pending; batch = db.batch(); pending = 0; }
    }
    if (apply && pending > 0) { await batch.commit(); written += pending; }
    return written;
}

export const updateStationStats = onDocumentWritten('fuelLogs/{logId}', async (event) => {
    await handleLogWrite(
        getFirestore(),
        event.id,
        event.data?.before.data() as LogFields | undefined,
        event.data?.after.data() as LogFields | undefined,
    );
});

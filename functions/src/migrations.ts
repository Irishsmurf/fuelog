// functions/src/migrations.ts
//
// One-shot data migrations that run server-side right after deploy, so a
// release that changes how data is derived doesn't depend on someone running
// a script by hand. Each migration records completion in `migrations/<id>`;
// once done, every later run is a single document read.
//
// A migration that can't finish within one run (e.g. rate-limited lookups)
// returns `done: false` with a `state` to resume from; it is saved in the
// same document without `completedAt`, and the next run continues from it.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { rebuildAllStationStats } from './stationStats';

export interface MigrationOutcome {
    /** false: not finished; run again from `state` next time. Default true. */
    done?: boolean;
    state?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface Migration {
    id: string;
    run: (db: Firestore, state: Record<string, unknown> | undefined) => Promise<MigrationOutcome>;
}

/** Each scheduled run stops starting new work after this long (the function times out at 540 s). */
export const RUN_BUDGET_MS = 420_000;

export const MIGRATIONS: Migration[] = [
    {
        // Station price stats moved from the client-maintained, currency-mixed
        // `avgPrice` to per-currency `priceStats` maintained by updateStationStats.
        id: 'stationPriceStats_v1',
        run: async (db) => ({ stationsWritten: await rebuildAllStationStats(db, true, console.log) }),
    },
    // derivedLogFields_v1 (odometer-derived distances, price/efficiency and
    // station links for logs written before onLogWrite) is deliberately NOT
    // scheduled: it bulk-rewrites existing user data, so an operator runs it
    // by hand after reviewing a dry run (functions/src/scripts/derivedLogFields.ts).
    // It supports the resumable { done: false, state } contract above if it is
    // ever registered here.
];

/** Runs every pending migration once, in order. Exported for tests. */
export async function runPendingMigrations(db: Firestore, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
    const ran: string[] = [];
    for (const m of migrations) {
        const ref = db.collection('migrations').doc(m.id);
        const snap = await ref.get();
        const prior = snap.data();
        if (snap.exists && prior?.completedAt) continue;
        const { done = true, state, ...result } = await m.run(db, prior?.state as Record<string, unknown> | undefined);
        if (!done) {
            // Later migrations wait: they may depend on this one.
            await ref.set({ updatedAt: Timestamp.now(), state: state ?? null, lastRun: result });
            break;
        }
        await ref.set({ completedAt: Timestamp.now(), ...result });
        ran.push(m.id);
    }
    return ran;
}

export const runMigrations = onSchedule({ schedule: 'every 60 minutes', timeoutSeconds: 540, memory: '512MiB' }, async () => {
    const ran = await runPendingMigrations(getFirestore());
    if (ran.length) console.log(`Migrations completed: ${ran.join(', ')}`);
});

// functions/src/migrations.ts
//
// One-shot data migrations that run server-side right after deploy, so a
// release that changes how data is derived doesn't depend on someone running
// a script by hand. Each migration records completion in `migrations/<id>`;
// once done, every later run is a single document read.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { rebuildAllStationStats } from './stationStats';

interface Migration {
    id: string;
    run: (db: Firestore) => Promise<Record<string, unknown>>;
}

export const MIGRATIONS: Migration[] = [
    {
        // Station price stats moved from the client-maintained, currency-mixed
        // `avgPrice` to per-currency `priceStats` maintained by updateStationStats.
        id: 'stationPriceStats_v1',
        run: async (db) => ({ stationsWritten: await rebuildAllStationStats(db, true, console.log) }),
    },
];

/** Runs every pending migration once, in order. Exported for tests. */
export async function runPendingMigrations(db: Firestore, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
    const ran: string[] = [];
    for (const m of migrations) {
        const ref = db.collection('migrations').doc(m.id);
        if ((await ref.get()).exists) continue;
        const result = await m.run(db);
        await ref.set({ completedAt: Timestamp.now(), ...result });
        ran.push(m.id);
    }
    return ran;
}

export const runMigrations = onSchedule('every 60 minutes', async () => {
    const ran = await runPendingMigrations(getFirestore());
    if (ran.length) console.log(`Migrations completed: ${ran.join(', ')}`);
});

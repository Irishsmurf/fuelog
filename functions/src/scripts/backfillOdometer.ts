// functions/src/scripts/backfillOdometer.ts
//
// One-off backfill job.
//
// Odometer tracking (fuelLogs.odometerKm) was added long after logging began,
// so older logs only carry `distanceKm` — the distance covered since the
// previous fill-up — and have no absolute odometer reading.
//
// The odometer is just the running sum of those distances, so a single known
// reading lets us reconstruct every other reading for that vehicle:
//
//   odometer[i]   = odometer[i-1] + distanceKm[i]      (walking forwards)
//   odometer[i-1] = odometer[i]   - distanceKm[i]      (walking backwards)
//
// Because the only readings we have are recent ones, the job mostly walks
// *backwards* from the earliest known reading to fill in the history. Each
// vehicle has its own odometer, so logs are reconstructed per (user, vehicle).
// Existing readings are never overwritten — they act as anchors the
// reconstruction radiates out from, re-anchoring on any reading it meets so
// rounding drift can't accumulate across the whole history.
//
// Usage (from the functions/ directory):
//   npm run backfill-odometer                   # write reconstructed readings
//   npm run backfill-odometer -- --dry-run      # report what would change
//   npm run backfill-odometer -- --user=<uid>   # limit to a single user
//
// Credentials are read via application default credentials, e.g.:
//   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run backfill-odometer

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const USER_ARG = process.argv.find((a) => a.startsWith('--user='));
const ONLY_USER = USER_ARG ? USER_ARG.slice('--user='.length) : undefined;

const NO_VEHICLE = '__no_vehicle__';

/** Minimal shape of a log needed to plan a backfill. Decoupled from Firestore
 *  so the planner can be unit-tested with plain objects. */
export interface BackfillLog {
  id: string;
  userId: string;
  vehicleId?: string;
  /** Anything exposing toMillis() (a Firestore Timestamp) — used for ordering. */
  timestamp: { toMillis: () => number };
  distanceKm: number;
  odometerKm?: number;
}

/** A single computed odometer value to write back to a log. */
export interface OdometerBackfillUpdate {
  id: string;
  odometerKm: number;
}

export interface OdometerBackfillPlan {
  /** Logs that should be written with a reconstructed odometer reading. */
  updates: OdometerBackfillUpdate[];
  /** Logs that already had an odometer reading and were left untouched. */
  alreadySet: number;
  /** Logs that could not be reconstructed (no anchor reachable, or a missing/
   *  invalid distance broke the chain). */
  skipped: number;
  /** (user, vehicle) groups that had at least one reading to anchor from. */
  vehiclesAnchored: number;
  /** (user, vehicle) groups with logs but no reading at all. */
  vehiclesWithoutAnchor: number;
}

const isValidReading = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isValidDistance = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Reconstructs missing odometer readings for one vehicle's logs (sorted
 * oldest-first), pushing results onto the shared `updates` array. Returns
 * whether the group had any reading to anchor from.
 */
function planVehicleGroup(sorted: BackfillLog[], updates: OdometerBackfillUpdate[]): boolean {
  const firstAnchor = sorted.findIndex((log) => isValidReading(log.odometerKm));
  if (firstAnchor === -1) return false;

  // Walk forwards from the earliest known reading, filling any later gaps.
  let running: number | null = sorted[firstAnchor].odometerKm!;
  for (let i = firstAnchor + 1; i < sorted.length; i++) {
    const log = sorted[i];
    if (isValidReading(log.odometerKm)) {
      running = log.odometerKm; // re-anchor on the next real reading
      continue;
    }
    if (running !== null && isValidDistance(log.distanceKm)) {
      running += log.distanceKm;
      updates.push({ id: log.id, odometerKm: running });
    } else {
      running = null; // chain broken until the next real reading
    }
  }

  // Walk backwards from the earliest known reading, filling older logs.
  running = sorted[firstAnchor].odometerKm!;
  for (let i = firstAnchor; i > 0; i--) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (isValidReading(previous.odometerKm)) {
      running = previous.odometerKm; // re-anchor on the next real reading
      continue;
    }
    // distanceKm on `current` is the distance travelled to reach it from `previous`.
    if (running !== null && isValidDistance(current.distanceKm)) {
      const previousOdometer: number = running - current.distanceKm;
      // >= 0: a brand-new vehicle can legitimately read 0, matching isValidReading.
      if (previousOdometer >= 0) {
        updates.push({ id: previous.id, odometerKm: previousOdometer });
        running = previousOdometer;
        continue;
      }
    }
    running = null; // can't sensibly go further back
  }

  return true;
}

/**
 * Pure planner: given every fuel log, works out which logs can have their
 * odometer reconstructed and what value each should take. No Firestore access,
 * so it is fully unit-testable.
 */
export function planOdometerBackfill(logs: BackfillLog[]): OdometerBackfillPlan {
  // Group per (user, vehicle) — odometers are per-vehicle, and logs predating
  // multi-vehicle support have no vehicleId, so they share a single group.
  const groups = new Map<string, BackfillLog[]>();
  for (const log of logs) {
    const key = `${log.userId}::${log.vehicleId ?? NO_VEHICLE}`;
    const group = groups.get(key);
    if (group) group.push(log);
    else groups.set(key, [log]);
  }

  const updates: OdometerBackfillUpdate[] = [];
  let vehiclesAnchored = 0;
  let vehiclesWithoutAnchor = 0;

  for (const group of groups.values()) {
    // Drop records with a missing/malformed timestamp — they can't be ordered,
    // and calling toMillis() on them would crash the whole job.
    const sorted = [...group]
      .filter((log) => log.timestamp && typeof log.timestamp.toMillis === 'function')
      .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    if (planVehicleGroup(sorted, updates)) vehiclesAnchored++;
    else vehiclesWithoutAnchor++;
  }

  const alreadySet = logs.filter((log) => isValidReading(log.odometerKm)).length;
  const skipped = logs.length - alreadySet - updates.length;

  return { updates, alreadySet, skipped, vehiclesAnchored, vehiclesWithoutAnchor };
}

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  console.log(
    'Reconstructing odometer readings from distance history' +
      (ONLY_USER ? ` for user ${ONLY_USER}` : ' for all users') +
      (DRY_RUN ? '  (dry run — nothing will be written)' : ''),
  );

  // Select only the fields the backfill needs — fuelLogs can carry large fields
  // (receipt URLs, etc.) we never read, so this keeps memory and bandwidth down.
  let queryRef: FirebaseFirestore.Query = db
    .collection('fuelLogs')
    .select('userId', 'vehicleId', 'timestamp', 'distanceKm', 'odometerKm');
  if (ONLY_USER) queryRef = queryRef.where('userId', '==', ONLY_USER);

  const snapshot = await queryRef.get();
  const logs: BackfillLog[] = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      vehicleId: data.vehicleId,
      timestamp: data.timestamp,
      distanceKm: data.distanceKm,
      odometerKm: data.odometerKm,
    };
  });

  console.log(`Fetched ${logs.length} logs.`);

  const plan = planOdometerBackfill(logs);

  console.log(`\nPlan:`);
  console.log(`  ${DRY_RUN ? 'Would reconstruct' : 'Reconstruct'}: ${plan.updates.length}`);
  console.log(`  Already set:        ${plan.alreadySet}`);
  console.log(`  Skipped:            ${plan.skipped}`);
  console.log(`  Vehicles anchored:  ${plan.vehiclesAnchored}`);
  console.log(`  Vehicles w/o anchor: ${plan.vehiclesWithoutAnchor}`);

  if (plan.updates.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  if (DRY_RUN) {
    const sample = plan.updates.slice(0, 10);
    console.log('\nSample of reconstructed readings (first 10):');
    sample.forEach((u) => console.log(`  ${u.id}  ->  ${Math.round(u.odometerKm)} km`));
    return;
  }

  // Firestore caps writes at 500 per batch.
  const batchSize = 500;
  let written = 0;
  for (let i = 0; i < plan.updates.length; i += batchSize) {
    const batch = db.batch();
    const chunk = plan.updates.slice(i, i + batchSize);
    chunk.forEach(({ id, odometerKm }) => {
      // Round to whole km — odometers are integers and this absorbs the
      // floating-point drift from summing distances.
      batch.update(db.collection('fuelLogs').doc(id), { odometerKm: Math.round(odometerKm) });
    });
    await batch.commit();
    written += chunk.length;
    console.log(`  Wrote ${written}/${plan.updates.length}`);
  }

  console.log('\nDone.');
}

// Only run when invoked directly, so the planner can be imported by tests.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

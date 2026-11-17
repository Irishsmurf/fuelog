// functions/src/derivedLogFieldsMigration.ts
//
// One-off backfill of server-derived log fields for logs written before
// onLogWrite existed (migration `derivedLogFields_v1`). It replaces the
// retired scripts/backfillOdometer.ts and scripts/assignStationsToLogs.ts
// and the in-app "Identify Stations" action, and reuses their logic:
//
//   1. Odometer reconstruction (from backfillOdometer): older logs only carry
//      distanceKm, so readings are rebuilt per (user, vehicle) by walking the
//      distance chain out from each known reading. Existing readings are
//      never overwritten; reconstructed ones are rounded to whole km.
//   2. distanceKm from the readings (core deriveDistances), with the same
//      1 km tolerance as onLogWrite so rounded readings don't replace precise
//      user-entered distances. pricePerLitre / kmPerLitre are filled alongside.
//   3. stationId for logs with coordinates but no station (from
//      assignStationsToLogs): nearest OSM station, spaced-out Overpass calls,
//      best-effort (no station nearby or a failed lookup leaves it unset).
//
// Safe to re-run: every write is a diff against the stored value, and
// station lookups resume from a cursor (log ids in order) when a run hits its
// time budget. `apply: false` is a dry run that only reports.
//
// Writes for one (user, vehicle) are kept in the same batch where possible:
// onLogWrite fires on each committed reading and recomputes the next log's
// distance, which must see the whole reconstructed chain at once.

import type { Firestore } from 'firebase-admin/firestore';
import { deriveDistances } from '../../packages/core/src/odometer';
import {
    DISTANCE_TOLERANCE_KM, changedFields, defaultLookups, resolveStation, valuePatch,
    type DerivedLog, type DerivedPatch, type Lookups,
} from './logDerived';

export interface MigrationLog extends DerivedLog {
    id: string;
}

export type MigrationPatch = DerivedPatch & { odometerKm?: number };

export interface PhaseOnePlan {
    /** log id → fields to write, grouped by (user, vehicle) in write order. */
    groups: Map<string, MigrationPatch>[];
    odometerReconstructed: number;
    distancesUpdated: number;
    valuesUpdated: number;
    vehiclesWithoutAnchor: number;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isValidReading = (v: unknown): v is number => num(v) && v >= 0;
const isValidDistance = (v: unknown): v is number => num(v) && v > 0;
const atOf = (l: DerivedLog) => (l.timestamp && typeof l.timestamp.toMillis === 'function' ? l.timestamp.toMillis() : undefined);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Reconstructs missing odometer readings for one vehicle's logs (sorted
 * oldest-first). Ported unchanged from backfillOdometer's planVehicleGroup:
 * walk forwards and backwards from the earliest reading, re-anchoring on
 * every real reading so rounding drift can't accumulate. Returns false when
 * the group has no reading to anchor from.
 */
export function reconstructOdometer(sorted: MigrationLog[], out: Map<string, number>): boolean {
    const firstAnchor = sorted.findIndex((log) => isValidReading(log.odometerKm));
    if (firstAnchor === -1) return false;

    let running: number | null = sorted[firstAnchor].odometerKm!;
    for (let i = firstAnchor + 1; i < sorted.length; i++) {
        const log = sorted[i];
        if (isValidReading(log.odometerKm)) { running = log.odometerKm; continue; }
        if (running !== null && isValidDistance(log.distanceKm)) {
            running += log.distanceKm;
            out.set(log.id, running);
        } else {
            running = null; // chain broken until the next real reading
        }
    }

    running = sorted[firstAnchor].odometerKm!;
    for (let i = firstAnchor; i > 0; i--) {
        const current = sorted[i];
        const previous = sorted[i - 1];
        if (isValidReading(previous.odometerKm)) { running = previous.odometerKm; continue; }
        // distanceKm on `current` is the distance travelled since `previous`.
        if (running !== null && isValidDistance(current.distanceKm)) {
            const previousOdometer: number = running - current.distanceKm;
            if (previousOdometer >= 0) {
                out.set(previous.id, previousOdometer);
                running = previousOdometer;
                continue;
            }
        }
        running = null;
    }
    return true;
}

/** Pure planner for steps 1 and 2. No Firestore access. */
export function planPhaseOne(logs: MigrationLog[]): PhaseOnePlan {
    const byVehicle = new Map<string, MigrationLog[]>();
    for (const log of logs) {
        const key = `${log.userId ?? ''}::${log.vehicleId ?? ''}`;
        byVehicle.set(key, [...(byVehicle.get(key) ?? []), log]);
    }

    const plan: PhaseOnePlan = { groups: [], odometerReconstructed: 0, distancesUpdated: 0, valuesUpdated: 0, vehiclesWithoutAnchor: 0 };
    for (const key of [...byVehicle.keys()].sort()) {
        // Logs with a missing/malformed timestamp can't be ordered; leave them alone.
        const sorted = byVehicle.get(key)!
            .filter((l) => atOf(l) !== undefined)
            .sort((a, b) => atOf(a)! - atOf(b)! || a.id.localeCompare(b.id));

        const readings = new Map<string, number>();
        if (!reconstructOdometer(sorted, readings)) plan.vehiclesWithoutAnchor++;

        const withReadings = sorted.map((l) => {
            const r = readings.get(l.id);
            return r === undefined ? l : { ...l, odometerKm: Math.round(r) };
        });
        const derived = deriveDistances(withReadings.map((l) => ({
            id: l.id, at: atOf(l)!, odometerKm: isValidReading(l.odometerKm) ? l.odometerKm : undefined,
        })));

        const patches = new Map<string, MigrationPatch>();
        for (const l of withReadings) {
            const patch: MigrationPatch = {};
            if (readings.has(l.id)) { patch.odometerKm = l.odometerKm; plan.odometerReconstructed++; }
            const d = derived.get(l.id);
            const agrees = d !== undefined && isValidDistance(l.distanceKm) && Math.abs(l.distanceKm - d) < DISTANCE_TOLERANCE_KM;
            if (d !== undefined && !agrees) { patch.distanceKm = round6(d); plan.distancesUpdated++; }
            const values = valuePatch(l, patch.distanceKm ?? l.distanceKm);
            if (Object.keys(values).length > 0) plan.valuesUpdated++;
            Object.assign(patch, values);
            if (Object.keys(patch).length > 0) patches.set(l.id, patch);
        }
        if (patches.size > 0) plan.groups.push(patches);
    }
    return plan;
}

/** Logs step 3 acts on: coordinates but no station, in id order after `cursor`. */
export function selectStationCandidates(logs: MigrationLog[], cursor?: string): MigrationLog[] {
    return logs
        .filter((l) => !l.stationId && num(l.latitude) && num(l.longitude))
        .filter((l) => cursor === undefined || l.id > cursor)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Splits groups of writes into batches of at most `size`, never splitting a group that fits. */
export function packBatches<T>(groups: T[][], size: number): T[][] {
    const batches: T[][] = [];
    let current: T[] = [];
    for (const group of groups) {
        if (current.length + group.length > size && current.length > 0) { batches.push(current); current = []; }
        for (let i = 0; i < group.length; i += size) {
            const chunk = group.slice(i, i + size);
            if (current.length + chunk.length > size) { batches.push(current); current = []; }
            current.push(...chunk);
        }
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

export interface MigrationOptions {
    apply: boolean;
    userId?: string;
    log?: (msg: string) => void;
    lookups?: Lookups;
    /** Skip step 3 (no Overpass calls). */
    skipStations?: boolean;
    /** ms between Overpass calls, per its fair-use policy. */
    stationDelayMs?: number;
    /** Resume step 3 after this log id. */
    cursor?: string;
    /** Stop step 3 at this time (ms since epoch) and report `done: false`. */
    deadline?: number;
    /** Writes per batch (Firestore caps a batch at 500). */
    batchSize?: number;
    sleep?: (ms: number) => Promise<void>;
}

export interface MigrationResult {
    logsScanned: number;
    odometerReconstructed: number;
    distancesUpdated: number;
    valuesUpdated: number;
    vehiclesWithoutAnchor: number;
    logsWritten: number;
    batchesCommitted: number;
    stationCandidates: number;
    stationsAssigned: number;
    /** No station within the radius, or the lookup failed. */
    stationsUnresolved: number;
    /** Set when step 3 stopped at the deadline; resume after this id. */
    cursor?: string;
    done: boolean;
}

const MIGRATION_FIELDS = [
    'userId', 'vehicleId', 'timestamp', 'odometerKm', 'distanceKm', 'cost', 'fuelAmountLiters',
    'pricePerLitre', 'kmPerLitre', 'latitude', 'longitude', 'stationId',
] as const;

async function loadLogs(db: Firestore, userId?: string): Promise<MigrationLog[]> {
    let q: FirebaseFirestore.Query = db.collection('fuelLogs');
    if (userId) q = q.where('userId', '==', userId);
    const snap = await q.select(...MIGRATION_FIELDS).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DerivedLog) }));
}

/** Runs (or, with apply: false, reports) the backfill. */
export async function migrateDerivedLogFields(db: Firestore, opts: MigrationOptions): Promise<MigrationResult> {
    const {
        apply, log = () => {}, lookups = defaultLookups, stationDelayMs = 1100, batchSize = 400,
        sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    } = opts;

    const logs = await loadLogs(db, opts.userId);
    const byId = new Map(logs.map((l) => [l.id, l]));
    const plan = planPhaseOne(logs);
    log(`Logs: ${logs.length}; odometer readings to reconstruct: ${plan.odometerReconstructed}; ` +
        `distances to update: ${plan.distancesUpdated}; price/efficiency to fill: ${plan.valuesUpdated}; ` +
        `vehicles with no reading: ${plan.vehiclesWithoutAnchor}`);

    const result: MigrationResult = {
        logsScanned: logs.length,
        odometerReconstructed: plan.odometerReconstructed,
        distancesUpdated: plan.distancesUpdated,
        valuesUpdated: plan.valuesUpdated,
        vehiclesWithoutAnchor: plan.vehiclesWithoutAnchor,
        logsWritten: 0,
        batchesCommitted: 0,
        stationCandidates: 0,
        stationsAssigned: 0,
        stationsUnresolved: 0,
        done: true,
    };

    const writes = plan.groups.map((g) => [...g.entries()]);
    for (const batchWrites of packBatches(writes, batchSize)) {
        if (!apply) {
            for (const [id, patch] of batchWrites.slice(0, 20)) log(`  ${id}: ${JSON.stringify(patch)}`);
            continue;
        }
        const batch = db.batch();
        for (const [id, patch] of batchWrites) {
            batch.update(db.collection('fuelLogs').doc(id), changedFields(byId.get(id)!, patch));
        }
        await batch.commit();
        result.logsWritten += batchWrites.length;
        result.batchesCommitted++;
    }

    if (opts.skipStations) return result;

    const candidates = selectStationCandidates(logs, opts.cursor);
    result.stationCandidates = candidates.length;
    log(`Logs with coordinates but no station: ${candidates.length}`);
    let batch = db.batch();
    let pending = 0;
    const flush = async () => {
        if (pending === 0) return;
        await batch.commit();
        result.batchesCommitted++;
        result.logsWritten += pending;
        batch = db.batch();
        pending = 0;
    };

    for (let i = 0; i < candidates.length; i++) {
        const l = candidates[i];
        if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
            result.done = false;
            result.cursor = i > 0 ? candidates[i - 1].id : opts.cursor;
            break;
        }
        if (i > 0) await sleep(stationDelayMs);
        // In a dry run, look up without creating station documents.
        const stationId = apply
            ? await resolveStation(db, lookups, l.latitude!, l.longitude!)
            : await lookups.findStation(l.latitude!, l.longitude!).then((s) => (s ? s.id : null), () => null);
        if (!stationId) { result.stationsUnresolved++; continue; }
        result.stationsAssigned++;
        log(`  ${l.id} -> ${stationId}`);
        if (!apply) continue;
        batch.update(db.collection('fuelLogs').doc(l.id), { stationId });
        if (++pending >= batchSize) await flush();
    }
    if (apply) await flush();
    return result;
}

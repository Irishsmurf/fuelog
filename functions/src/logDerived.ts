// functions/src/logDerived.ts
//
// Server-derived fuel-log fields (rewrite plan §4 "Server-derived"). Fires on
// every fuelLogs write and keeps these correct, whoever wrote the log (app,
// import, REST/MCP, Admin scripts):
//
//   distanceKm      from odometerKm and the previous reading of the same
//                   (user, vehicle), for the written log and for the next log
//                   with a reading, so inserting, back-dating, editing or
//                   deleting a log fixes its neighbour too.
//   stationId       nearest OSM station when the log has coordinates but no
//                   station. Best-effort: a failed lookup leaves it unset.
//   cost/exchangeRate  home-currency cost, only when the writer gave
//                   originalCost + currency but no cost (the app always
//                   writes both itself, for its offline UX).
//   pricePerLitre   cost / litres, in home currency.
//   kmPerLitre      distanceKm / litres (per-log efficiency).
//
// Loop prevention: the trigger fires on its own writes. It only ever writes
// fields whose value actually changes, and every derived value is a pure
// function of input fields it never writes (odometer, timestamp, vehicle,
// litres, coordinates, originalCost/currency) plus the fields it derives in
// the same write, so the re-fired event computes an empty patch and stops.
// The neighbour recompute only runs when an odometer input changed, which the
// trigger's own writes never do. Redelivered events are applied at most once
// through a `triggerEvents/logDerived_<eventId>` marker, as in stationStats.
//
// Station price statistics are not touched here: linking a stationId makes
// updateStationStats fold the log in.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { deriveDistances } from '../../packages/core/src/odometer';
import { kmPerLitre, pricePerLitre } from '../../packages/core/src/efficiency';
import { newStationDoc, stationDocId, type OSMStation } from '../../packages/core/src/overpass';
import { fetchExchangeRate, findNearestStation } from './lookups';

/** The log fields read or written by the derivation. */
export interface DerivedLog {
    userId?: string;
    vehicleId?: string;
    timestamp?: { toMillis(): number };
    odometerKm?: number;
    distanceKm?: number;
    cost?: number;
    fuelAmountLiters?: number;
    originalCost?: number;
    currency?: string;
    exchangeRate?: number;
    latitude?: number;
    longitude?: number;
    stationId?: string;
    pricePerLitre?: number;
    kmPerLitre?: number;
    /** The fill-up's local calendar date (YYYY-MM-DD), when the writer knows it. */
    localDate?: string;
}

/** Fields this module writes. `null` deletes the field. */
export type DerivedPatch = Partial<{
    distanceKm: number;
    pricePerLitre: number | null;
    kmPerLitre: number | null;
    stationId: string;
    cost: number;
    exchangeRate: number;
}>;

export const LOG_FIELDS = [
    'userId', 'vehicleId', 'timestamp', 'odometerKm', 'distanceKm', 'cost', 'fuelAmountLiters',
    'pricePerLitre', 'kmPerLitre',
] as const;

/**
 * Odometer readings are whole-km in practice (and the old backfill rounded
 * reconstructed readings to whole km), so a derived distance less than 1 km
 * away from the stored one agrees with it: a user-entered 412.3 km is not
 * replaced by a 412 km difference of rounded readings.
 */
export const DISTANCE_TOLERANCE_KM = 1;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const atOf = (log: DerivedLog | undefined): number | undefined => {
    const t = log?.timestamp;
    return t && typeof t.toMillis === 'function' ? t.toMillis() : undefined;
};
const vehicleKey = (log: DerivedLog) => `${log.userId ?? ''}::${log.vehicleId ?? ''}`;

const validReading = (v: unknown): v is number => num(v) && v >= 0;

const distanceAgrees = (stored: unknown, derived: number) =>
    num(stored) && stored > 0 && Math.abs(stored - derived) < DISTANCE_TOLERANCE_KM;

const sameNumber = (a: unknown, b: number | null) =>
    b === null ? a === undefined || a === null : num(a) && Math.abs(a - b) < 1e-9;

/**
 * pricePerLitre and kmPerLitre for a log whose (possibly just derived)
 * distance and cost are given, as a patch of the fields that change.
 */
export function valuePatch(log: DerivedLog, distanceKm = log.distanceKm, cost = log.cost): DerivedPatch {
    const patch: DerivedPatch = {};
    const litres = log.fuelAmountLiters;
    const ppl = num(cost) && num(litres) ? pricePerLitre(cost, litres) : null;
    const kml = num(distanceKm) && num(litres) ? kmPerLitre(distanceKm, litres) : null;
    const nextPpl = ppl === null ? null : round6(ppl);
    const nextKml = kml === null ? null : round6(kml);
    if (!sameNumber(log.pricePerLitre, nextPpl)) patch.pricePerLitre = nextPpl;
    if (!sameNumber(log.kmPerLitre, nextKml)) patch.kmPerLitre = nextKml;
    return patch;
}

/** Whether a write changed anything the odometer-derived distances depend on. */
export function odometerInputsChanged(before: DerivedLog | undefined, after: DerivedLog | undefined): boolean {
    if (!before || !after) return validReading(before?.odometerKm) || validReading(after?.odometerKm);
    if (!validReading(before.odometerKm) && !validReading(after.odometerKm)) return false;
    return before.odometerKm !== after.odometerKm
        || atOf(before) !== atOf(after)
        || vehicleKey(before) !== vehicleKey(after);
}

export interface GroupLog extends DerivedLog {
    id: string;
}

/** Same (at, id) order as core's deriveDistances. */
const after = (a: { at: number; id: string }, b: { at: number; id: string }) =>
    a.at > b.at || (a.at === b.at && a.id > b.id);

/**
 * The first log with an odometer reading strictly after position (at, id) in
 * `group`, ignoring `excludeId`: the log whose distance a write at that
 * position can change.
 */
export function nextReadingAfter(group: GroupLog[], at: number, id: string, excludeId: string): GroupLog | undefined {
    let best: { log: GroupLog; at: number } | undefined;
    for (const log of group) {
        const logAt = atOf(log);
        if (log.id === excludeId || logAt === undefined || !validReading(log.odometerKm)) continue;
        if (!after({ at: logAt, id: log.id }, { at, id })) continue;
        if (!best || after({ at: best.at, id: best.log.id }, { at: logAt, id: log.id })) best = { log, at: logAt };
    }
    return best?.log;
}

/** Distance (and dependent efficiency) patches for `targets`, derived from `group`. */
export function distancePatches(group: GroupLog[], targets: string[]): Map<string, DerivedPatch> {
    const entries = group.flatMap((l) => {
        const at = atOf(l);
        return at === undefined ? [] : [{ id: l.id, at, odometerKm: validReading(l.odometerKm) ? l.odometerKm : undefined }];
    });
    const derived = deriveDistances(entries);
    const byId = new Map(group.map((l) => [l.id, l]));
    const out = new Map<string, DerivedPatch>();
    for (const id of new Set(targets)) {
        const log = byId.get(id);
        const d = derived.get(id);
        if (!log || d === undefined || distanceAgrees(log.distanceKm, d)) continue;
        const distanceKm = round6(d);
        out.set(id, { distanceKm, ...valuePatch(log, distanceKm) });
    }
    return out;
}

/**
 * Which logs' distances a write can change: the written log itself (at its
 * new position) and the next reading after both its old and new positions.
 * `logs` is the current state of the affected users' logs (after the write).
 */
export function planDistanceUpdates(
    logId: string,
    before: DerivedLog | undefined,
    afterLog: DerivedLog | undefined,
    logs: GroupLog[],
): Map<string, DerivedPatch> {
    const groups = new Map<string, GroupLog[]>();
    for (const l of logs) {
        const k = vehicleKey(l);
        groups.set(k, [...(groups.get(k) ?? []), l]);
    }
    const out = new Map<string, DerivedPatch>();
    const consider = (side: DerivedLog | undefined, includeSelf: boolean) => {
        const at = atOf(side);
        if (!side || at === undefined) return;
        const group = groups.get(vehicleKey(side)) ?? [];
        const targets: string[] = [];
        if (includeSelf && validReading(side.odometerKm)) targets.push(logId);
        const next = nextReadingAfter(group, at, logId, logId);
        if (next) targets.push(next.id);
        for (const [id, p] of distancePatches(group, targets)) out.set(id, { ...out.get(id), ...p });
    };
    consider(before, false);
    consider(afterLog, true);
    return out;
}

/** The date an exchange rate applies to: the writer's local date, else the UTC date. */
export function rateDate(log: DerivedLog): string | null {
    if (typeof log.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.localDate)) return log.localDate;
    const at = atOf(log);
    return at === undefined ? null : new Date(at).toISOString().slice(0, 10);
}

export interface Lookups {
    findStation: (lat: number, lon: number) => Promise<OSMStation | null>;
    fetchRate: (ymd: string, from: string, to: string) => Promise<number | null>;
}

export const defaultLookups: Lookups = {
    findStation: (lat, lon) => findNearestStation(lat, lon),
    fetchRate: (ymd, from, to) => fetchExchangeRate(ymd, from, to),
};

const hasCoords = (log: DerivedLog) => num(log.latitude) && num(log.longitude);

/** Whether a write should trigger a station lookup (new coordinates, no station). */
export function needsStationLookup(before: DerivedLog | undefined, afterLog: DerivedLog): boolean {
    if (afterLog.stationId || !hasCoords(afterLog)) return false;
    // Only when the coordinates are new, so a log with no station nearby (or
    // a failed lookup) isn't looked up again on every unrelated edit.
    return !before || before.latitude !== afterLog.latitude || before.longitude !== afterLog.longitude;
}

/** Gets-or-creates the station document; returns its id, or null on failure. */
export async function ensureStation(db: Firestore, station: OSMStation): Promise<string | null> {
    const id = stationDocId(station.id);
    try {
        await db.collection('stations').doc(id).create(newStationDoc(station));
    } catch (err) {
        if ((err as { code?: number }).code !== 6) { // 6 = ALREADY_EXISTS
            console.warn(`Could not create station ${id}:`, err);
            return null;
        }
    }
    return id;
}

/** Best-effort station id for coordinates: never throws. */
export async function resolveStation(db: Firestore, lookups: Lookups, lat: number, lon: number): Promise<string | null> {
    try {
        const station = await lookups.findStation(lat, lon);
        return station ? await ensureStation(db, station) : null;
    } catch (err) {
        console.warn(`Station lookup failed for (${lat}, ${lon}):`, err);
        return null;
    }
}

async function homeCurrencyOf(db: Firestore, userId: string | undefined): Promise<string> {
    if (!userId) return 'EUR';
    const snap = await db.collection('userProfiles').doc(userId).get();
    return (snap.data()?.homeCurrency as string | undefined) ?? 'EUR';
}

/** The written log's own derived fields: home-currency cost, station, price and efficiency. */
export async function planOwnFields(
    db: Firestore,
    lookups: Lookups,
    before: DerivedLog | undefined,
    afterLog: DerivedLog,
    derivedDistanceKm?: number,
): Promise<DerivedPatch> {
    const patch: DerivedPatch = {};
    if (derivedDistanceKm !== undefined) patch.distanceKm = derivedDistanceKm;

    if (!num(afterLog.cost) && num(afterLog.originalCost) && typeof afterLog.currency === 'string') {
        const home = await homeCurrencyOf(db, afterLog.userId);
        const ymd = rateDate(afterLog);
        const rate = afterLog.currency === home ? 1 : ymd ? await lookups.fetchRate(ymd, afterLog.currency, home) : null;
        if (rate !== null) {
            patch.cost = round6(afterLog.originalCost * rate);
            patch.exchangeRate = rate;
        }
    }

    if (needsStationLookup(before, afterLog)) {
        const stationId = await resolveStation(db, lookups, afterLog.latitude!, afterLog.longitude!);
        if (stationId) patch.stationId = stationId;
    }

    return { ...patch, ...valuePatch(afterLog, patch.distanceKm ?? afterLog.distanceKm, patch.cost ?? afterLog.cost) };
}

/** Reads a user's logs with only the fields the derivation needs. */
export async function loadUserLogs(db: Firestore, userId: string): Promise<GroupLog[]> {
    const snap = await db.collection('fuelLogs').where('userId', '==', userId).select(...LOG_FIELDS).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DerivedLog) }));
}

/**
 * A fingerprint of the inputs a plan was computed from. The transaction only
 * applies a patch if the log still has the same inputs; otherwise a newer
 * event for that log recomputes it. Neighbours were read with LOG_FIELDS
 * only, so their fingerprint covers just those (`full` = false).
 */
export function inputsOf(log: DerivedLog | undefined, full = true): string {
    if (!log) return 'deleted';
    const base = [log.userId, log.vehicleId, atOf(log), log.odometerKm, log.cost, log.fuelAmountLiters];
    return JSON.stringify(full ? [...base, log.latitude, log.longitude, log.originalCost, log.currency] : base);
}

/** Only the patch fields whose value differs from `current`. */
export function changedFields(current: DerivedLog, patch: DerivedPatch): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
        const cur = (current as Record<string, unknown>)[k];
        // Fill-only fields: never replace a station or cost a writer has set since.
        if (k === 'stationId' && current.stationId) continue;
        if ((k === 'cost' || k === 'exchangeRate') && num(current.cost)) continue;
        if (v === null) {
            if (cur !== undefined && cur !== null) out[k] = FieldValue.delete();
        } else if (typeof v === 'number' ? !sameNumber(cur, v) : cur !== v) {
            out[k] = v;
        }
    }
    return out;
}

export type HandleResult = 'skipped' | 'duplicate' | 'applied';

/**
 * Applies one fuelLogs write. Exported for tests; `eventId` makes it
 * idempotent across redelivery.
 */
export async function handleLogDerivedWrite(
    db: Firestore,
    eventId: string,
    logId: string,
    before: DerivedLog | undefined,
    afterLog: DerivedLog | undefined,
    lookups: Lookups = defaultLookups,
): Promise<HandleResult> {
    const plans = new Map<string, { patch: DerivedPatch; full: boolean; inputs: string }>();
    const add = (id: string, patch: DerivedPatch, full: boolean, inputs: string) => {
        if (Object.keys(patch).length > 0) plans.set(id, { patch, full, inputs });
    };

    let ownDistanceKm: number | undefined;
    if (odometerInputsChanged(before, afterLog)) {
        const users = [...new Set([before?.userId, afterLog?.userId].filter((u): u is string => !!u))];
        const logs = (await Promise.all(users.map((u) => loadUserLogs(db, u)))).flat();
        const byId = new Map(logs.map((l) => [l.id, l]));
        for (const [id, patch] of planDistanceUpdates(logId, before, afterLog, logs)) {
            if (id === logId) ownDistanceKm = patch.distanceKm;
            else add(id, patch, false, inputsOf(byId.get(id), false));
        }
    }

    if (afterLog) add(logId, await planOwnFields(db, lookups, before, afterLog, ownDistanceKm), true, inputsOf(afterLog));

    if (plans.size === 0) return 'skipped';

    const marker = db.collection('triggerEvents').doc(`logDerived_${eventId}`);
    return db.runTransaction(async (tx) => {
        if ((await tx.get(marker)).exists) return 'duplicate' as const;
        const ids = [...plans.keys()];
        const refs = ids.map((id) => db.collection('fuelLogs').doc(id));
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));
        snaps.forEach((snap, i) => {
            if (!snap.exists) return;
            const current = snap.data() as DerivedLog;
            const plan = plans.get(ids[i])!;
            if (inputsOf(current, plan.full) !== plan.inputs) return; // Changed since; its own event recomputes it.
            const update = changedFields(current, plan.patch);
            if (Object.keys(update).length > 0) tx.update(refs[i], update);
        });
        // expireAt lets a Firestore TTL policy prune old markers.
        tx.set(marker, { createdAt: Timestamp.now(), expireAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000) });
        return 'applied' as const;
    });
}

export const onLogWrite = onDocumentWritten({ document: 'fuelLogs/{logId}', timeoutSeconds: 120 }, async (event) => {
    await handleLogDerivedWrite(
        getFirestore(),
        event.id,
        event.params.logId,
        event.data?.before.data() as DerivedLog | undefined,
        event.data?.after.data() as DerivedLog | undefined,
    );
});

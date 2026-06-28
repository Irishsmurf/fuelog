// functions/src/scripts/assignStationsToLogs.ts
//
// One-off backfill job.
//
// Station association (fuelLogs.stationId) links a fuelling to a physical
// petrol station so the map can group fillings by station instead of by raw
// GPS proximity. Logs that have coordinates but no stationId — including ones
// whose locations were pinned retroactively by hand — have nothing to group on,
// so the map falls back to rounding their coordinates and renders them as
// loose "unassigned" clusters (see src/components/FuelMapPage.tsx).
//
// This job resolves each such log to a station the same way live logging does:
// it queries the OpenStreetMap Overpass API for the nearest `amenity=fuel`
// within a radius, gets-or-creates the matching global `stations` document,
// writes its id back onto the log, and folds the log's price into the station's
// running average. It mirrors the in-app "Identify Stations" maintenance action
// (src/utils/migrationService.ts) but runs server-side over every user at once.
//
// Usage (from the functions/ directory):
//   npm run assign-stations                       # assign stations, write changes
//   npm run assign-stations -- --dry-run          # report what would change
//   npm run assign-stations -- --user=<uid>       # limit to a single user
//   npm run assign-stations -- --project=<id>     # target a specific project
//   npm run assign-stations -- --radius=250       # search radius in metres (default 150)
//   npm run assign-stations -- --delay=1500       # ms between Overpass calls (default 1100)
//   npm run assign-stations -- --verbose          # print each log as it is resolved
//
// Overpass enforces fair-use rate limits, so calls are spaced out (--delay) and
// retried with exponential backoff on HTTP 429. A large backlog therefore takes
// a while; the radius and delay let you trade speed against accuracy and load.
//
// The Firestore project defaults to fuelog-paddez and can be overridden with
// --project=<id> or GOOGLE_CLOUD_PROJECT. Credentials are read via application
// default credentials, e.g.:
//   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run assign-stations

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const USER_ARG = process.argv.find((a) => a.startsWith('--user='));
const ONLY_USER = USER_ARG ? USER_ARG.slice('--user='.length) : undefined;

const RADIUS_ARG = process.argv.find((a) => a.startsWith('--radius='));
const RADIUS_METERS = RADIUS_ARG ? Number(RADIUS_ARG.slice('--radius='.length)) : 150;

const DELAY_ARG = process.argv.find((a) => a.startsWith('--delay='));
const DELAY_MS = DELAY_ARG ? Number(DELAY_ARG.slice('--delay='.length)) : 1100;

// Pin the Firestore project explicitly. Without this, applicationDefault()
// resolves to whatever project the ambient credentials default to, which can
// silently be the wrong (empty) project — the symptom is "Fetched 0 logs".
// Override with --project=<id> or the standard GOOGLE_CLOUD_PROJECT env var.
const PROJECT_ARG = process.argv.find((a) => a.startsWith('--project='));
const PROJECT_ID =
  (PROJECT_ARG ? PROJECT_ARG.slice('--project='.length) : undefined) ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  'fuelog-paddez';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Cap a single Overpass request so a hung connection can't stall the batch
// indefinitely. The query itself also self-limits server-side ([timeout:25]).
const REQUEST_TIMEOUT_MS = 30000;

/** A petrol station resolved from OpenStreetMap. Mirrors OSMStation in
 *  src/utils/locationService.ts so the data written here matches live logging. */
export interface OSMStation {
  id: string; // e.g. "node/123" — unique OSM identifier
  osmId: string;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

/** The raw shape Overpass returns for a single map element. */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat: number;
  lon: number;
  tags?: {
    amenity?: string;
    name?: string;
    brand?: string;
    operator?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
  };
  center?: { lat: number; lon: number };
}

/** Minimal shape of a log needed to assign a station. Decoupled from Firestore
 *  so the planner can be unit-tested with plain objects. */
export interface AssignLog {
  id: string;
  userId: string;
  latitude?: number;
  longitude?: number;
  stationId?: string;
  cost?: number;
  fuelAmountLiters?: number;
}

const isValidCoord = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Pure selector: the logs this job can act on are the ones with usable
 * coordinates but no station yet — exactly the entries that surface as
 * "unassigned" clusters on the map. No Firestore access, so it is unit-testable.
 */
export function selectUnassignedLogs(logs: AssignLog[]): AssignLog[] {
  return logs.filter(
    (log) => !log.stationId && isValidCoord(log.latitude) && isValidCoord(log.longitude),
  );
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two coordinates, in kilometres. Mirrors
 * haversineDistanceKm in src/utils/locationService.ts.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pure picker: given the elements Overpass returned around (lat, lon), choose
 * the closest fuel station and map it to an OSMStation, or null if none qualify.
 * Mirrors the selection logic in src/utils/locationService.ts so the script and
 * the app agree on which station a coordinate resolves to.
 */
export function pickNearestStation(
  elements: OverpassElement[],
  lat: number,
  lon: number,
): OSMStation | null {
  const stations = elements.filter((el) => el.tags && el.tags.amenity === 'fuel');
  if (stations.length === 0) return null;

  // A way/relation has no lat/lon of its own; fall back to its center, then to
  // the query point, so distance comparisons always have real coordinates.
  const coordsOf = (el: OverpassElement): { lat: number; lon: number } => {
    if (el.type === 'node') return { lat: el.lat, lon: el.lon };
    if (el.center) return { lat: el.center.lat, lon: el.center.lon };
    return { lat, lon };
  };

  const best = stations.reduce((closest, candidate) => {
    const c = coordsOf(candidate);
    const b = coordsOf(closest);
    return haversineDistanceKm(c.lat, c.lon, lat, lon) <
      haversineDistanceKm(b.lat, b.lon, lat, lon)
      ? candidate
      : closest;
  });

  const { lat: finalLat, lon: finalLon } = coordsOf(best);
  const street = best.tags?.['addr:street'];

  return {
    id: `${best.type}/${best.id}`,
    osmId: `${best.type}/${best.id}`,
    name: best.tags?.name || best.tags?.brand || 'Unknown Station',
    brand: best.tags?.brand || best.tags?.operator,
    latitude: finalLat,
    longitude: finalLon,
    address: street ? `${street} ${best.tags?.['addr:housenumber'] || ''}`.trim() : undefined,
  };
}

/**
 * Firestore document id for a station. OSM ids contain "/", which is a path
 * separator in Firestore, so it is swapped for "_". Mirrors getOrCreateStation
 * in src/firebase/firestoreService.ts so both paths address the same document.
 */
export function stationDocId(osmId: string): string {
  return osmId.replace(/\//g, '_');
}

/**
 * Price per litre for a log, or null when the figures are missing/unusable so
 * callers can skip folding a bogus value into a station's average.
 */
export function pricePerLitre(cost: number | undefined, liters: number | undefined): number | null {
  if (typeof cost !== 'number' || typeof liters !== 'number') return null;
  if (!Number.isFinite(cost) || !Number.isFinite(liters) || liters <= 0) return null;
  return cost / liters;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Queries Overpass for fuel stations within `radiusMeters` of (lat, lon) and
 * returns the nearest as an OSMStation, or null when none are nearby. Retries
 * with exponential backoff on HTTP 429; other failures propagate so the caller
 * can count them as errors rather than silently skipping a log.
 */
export async function findNearestStation(
  lat: number,
  lon: number,
  radiusMeters: number = RADIUS_METERS,
): Promise<OSMStation | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
      way["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
    );
    out body;
    >;
    out center qt;
  `;

  const maxRetries = 3;
  let delay = 2000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isLastAttempt = attempt === maxRetries - 1;
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // 429 (rate limited) and 5xx (server) are transient — back off and retry.
      if (response.status === 429 || response.status >= 500) {
        if (isLastAttempt) {
          throw new Error(`Overpass API responded with status ${response.status}`);
        }
        console.warn(
          `  Overpass returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(delay);
        delay *= 2;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API responded with status ${response.status}`);
      }

      const data = (await response.json()) as { elements?: OverpassElement[] };
      return pickNearestStation(data.elements ?? [], lat, lon);
    } catch (err) {
      // Network failures and the AbortSignal timeout land here; retry them too,
      // but let the final failure propagate so the caller counts it as an error.
      if (isLastAttempt) throw err;
      console.warn(
        `  Overpass request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`,
        err,
      );
      await sleep(delay);
      delay *= 2;
    }
  }

  throw new Error('Overpass API unavailable after maximum retries.');
}

export interface AssignResult {
  assigned: number;
  /** Logs with no station within the search radius. */
  skipped: number;
  /** Logs whose lookup threw (network/Overpass errors). */
  failed: number;
}

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  if (!Number.isFinite(RADIUS_METERS) || RADIUS_METERS <= 0) {
    throw new Error(`Invalid --radius value: ${RADIUS_ARG}`);
  }

  console.log(
    'Assigning stations to coordinate-only logs' +
      (ONLY_USER ? ` for user ${ONLY_USER}` : ' for all users') +
      (DRY_RUN ? '  (dry run — nothing will be written)' : ''),
  );
  console.log(`Project: ${PROJECT_ID}  radius: ${RADIUS_METERS}m  delay: ${DELAY_MS}ms`);

  // Pull only the fields needed to resolve and price a station; fuelLogs can
  // carry large fields (receipt URLs, etc.) we never read here.
  let queryRef: FirebaseFirestore.Query = db
    .collection('fuelLogs')
    .select('userId', 'latitude', 'longitude', 'stationId', 'cost', 'fuelAmountLiters');
  if (ONLY_USER) queryRef = queryRef.where('userId', '==', ONLY_USER);

  const snapshot = await queryRef.get();
  const logs: AssignLog[] = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      latitude: data.latitude,
      longitude: data.longitude,
      stationId: data.stationId,
      cost: data.cost,
      fuelAmountLiters: data.fuelAmountLiters,
    };
  });

  console.log(`Fetched ${logs.length} logs.`);

  if (logs.length === 0) {
    console.warn(
      `\nNo logs found in project "${PROJECT_ID}".\n` +
        '  - Confirm the credentials target this project (GOOGLE_APPLICATION_CREDENTIALS).\n' +
        '  - Override the project with --project=<id> or GOOGLE_CLOUD_PROJECT=<id>.' +
        (ONLY_USER ? `\n  - Confirm --user=${ONLY_USER} is the correct UID.` : ''),
    );
    return;
  }

  const toAssign = selectUnassignedLogs(logs);
  console.log(`${toAssign.length} have coordinates but no station.`);

  if (toAssign.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const result: AssignResult = { assigned: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < toAssign.length; i++) {
    const log = toAssign[i];
    // Space out Overpass calls to stay within its fair-use limits.
    if (i > 0) await sleep(DELAY_MS);

    try {
      const nearest = await findNearestStation(log.latitude!, log.longitude!, RADIUS_METERS);
      if (!nearest) {
        result.skipped++;
        if (VERBOSE) {
          console.log(`  ${log.id}  no station within ${RADIUS_METERS}m — skipped`);
        }
        continue;
      }

      const docId = stationDocId(nearest.id);
      const price = pricePerLitre(log.cost, log.fuelAmountLiters);

      if (VERBOSE || DRY_RUN) {
        console.log(
          `  ${log.id}  ->  ${nearest.name} (${docId})` +
            (price !== null ? `  @ ${price.toFixed(3)}/L` : ''),
        );
      }

      if (DRY_RUN) {
        result.assigned++;
        continue;
      }

      await getOrCreateStation(db, nearest);
      await assignLogToStation(db, log.id, docId, price);

      result.assigned++;
    } catch (error) {
      console.error(`  Failed to assign station for log ${log.id}:`, error);
      result.failed++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Plan' : 'Result'}:`);
  console.log(`  ${DRY_RUN ? 'Would assign' : 'Assigned'}: ${result.assigned}`);
  console.log(`  Skipped (no station nearby): ${result.skipped}`);
  console.log(`  Failed (lookup errors):      ${result.failed}`);
  console.log(DRY_RUN ? '\nDry run complete.' : '\nDone.');
}

/**
 * Gets-or-creates the global station document for an OSM station, keyed by its
 * sanitised OSM id. Mirrors getOrCreateStation in firestoreService.ts; existing
 * documents are left untouched so concurrent app writes are never clobbered.
 */
async function getOrCreateStation(
  db: FirebaseFirestore.Firestore,
  osmStation: OSMStation,
): Promise<string> {
  const docId = stationDocId(osmStation.id);
  const ref = db.collection('stations').doc(docId);
  const snap = await ref.get();
  if (snap.exists) return docId;

  await ref.set({
    osmId: osmStation.osmId,
    name: osmStation.name,
    brand: osmStation.brand || '',
    latitude: osmStation.latitude,
    longitude: osmStation.longitude,
    address: osmStation.address || '',
    logCount: 0,
    avgPrice: 0,
  });
  return docId;
}

/**
 * Atomically stamps a log with its stationId and folds its price per litre into
 * the station's running average, in a single transaction. Doing both together
 * means a metrics failure can never leave the log marked as assigned (and thus
 * skipped on re-run) with its price silently dropped from the station average.
 * When the price is unusable, only the stationId is written. The averaging
 * mirrors updateStationMetrics in firestoreService.ts so figures stay
 * consistent with those produced during live logging.
 */
async function assignLogToStation(
  db: FirebaseFirestore.Firestore,
  logId: string,
  stationId: string,
  pricePerLitreValue: number | null,
): Promise<void> {
  const stationRef = db.collection('stations').doc(stationId);
  const logRef = db.collection('fuelLogs').doc(logId);

  await db.runTransaction(async (tx) => {
    // Read before any write (Firestore requires reads first).
    if (pricePerLitreValue !== null) {
      const snap = await tx.get(stationRef);
      if (snap.exists) {
        const data = snap.data() as { logCount?: number; avgPrice?: number };
        const currentCount = data.logCount || 0;
        const currentAvg = data.avgPrice || 0;
        const newAvg = (currentAvg * currentCount + pricePerLitreValue) / (currentCount + 1);
        tx.update(stationRef, {
          logCount: FieldValue.increment(1),
          avgPrice: newAvg,
          lastPrice: pricePerLitreValue,
        });
      }
    }
    tx.update(logRef, { stationId });
  });
}

// Only run when invoked directly, so the pure helpers can be imported by tests.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

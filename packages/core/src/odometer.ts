import { distanceFromOdometer } from './efficiency.js';

/** The minimal shape the odometer rules need from a fuel log. */
export interface OdometerEntry {
  id: string;
  /** Milliseconds since epoch of the fill-up. */
  at: number;
  odometerKm?: number;
}

export interface OdometerViolation {
  id: string;
  previousId: string;
  odometerKm: number;
  previousOdometerKm: number;
}

const byTime = <T extends OdometerEntry>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

/**
 * Finds logs whose odometer reading does not increase on the previous
 * reading (in fill-up time order, ignoring logs without a reading).
 * Entries must all belong to one vehicle.
 */
export function findOdometerViolations(entries: OdometerEntry[]): OdometerViolation[] {
  const violations: OdometerViolation[] = [];
  let prev: OdometerEntry | undefined;
  for (const e of byTime(entries)) {
    if (e.odometerKm === undefined) continue;
    if (prev?.odometerKm !== undefined && e.odometerKm <= prev.odometerKm) {
      violations.push({
        id: e.id, previousId: prev.id, odometerKm: e.odometerKm, previousOdometerKm: prev.odometerKm,
      });
    }
    prev = e;
  }
  return violations;
}

/**
 * Derives each log's distance from the closest earlier odometer reading of
 * the same vehicle. Returns a map of log id → distance for the logs where a
 * distance can be derived (both readings present and increasing). Used to
 * recompute neighbours when a log is edited, back-dated or deleted.
 */
export function deriveDistances(entries: OdometerEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  let prevReading: number | undefined;
  for (const e of byTime(entries)) {
    if (e.odometerKm === undefined) continue;
    if (prevReading !== undefined) {
      const d = distanceFromOdometer(e.odometerKm, prevReading);
      if (d !== null) out.set(e.id, d);
    }
    prevReading = e.odometerKm;
  }
  return out;
}

/**
 * The odometer reading immediately before `at` (strictly earlier), i.e. the
 * reading a new or back-dated log at time `at` should be measured from.
 * Unlike "the most recently *entered* log", this is correct for back-dating.
 */
export function previousReading(entries: OdometerEntry[], at: number): number | null {
  let best: OdometerEntry | undefined;
  for (const e of entries) {
    if (e.odometerKm === undefined || e.at >= at) continue;
    if (!best || e.at > best.at) best = e;
  }
  return best?.odometerKm ?? null;
}

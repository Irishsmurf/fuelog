// Fuel-log reads for list views and exports. Pure Firestore access (no React)
// so it can be unit-tested and shared by hooks.
import {
  collection, query, where, orderBy, getDocs, limit, startAfter, Timestamp, getCountFromServer,
  type QueryConstraint, type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { fuelLogSchema, withId } from '../firebase/converters';
import type { Log } from '../utils/types';

export interface LogFilters {
  vehicleId?: string;
  /** Inclusive local date, YYYY-MM-DD. */
  startDate?: string;
  /** Inclusive local date, YYYY-MM-DD. */
  endDate?: string;
  /** Exact brand match. Applied client-side (Firestore can't combine it with the other filters without many indexes). */
  brand?: string;
}

export type LogCursor = QueryDocumentSnapshot<DocumentData>;

export interface LogsPage {
  logs: Log[];
  /** Cursor for the next page, or null when there is nothing more to load. */
  nextCursor: LogCursor | null;
  /** Distinct brands seen in the documents scanned for this page. */
  brands: string[];
}

export const DEFAULT_PAGE_SIZE = 25;
/** Upper bound on documents scanned to fill one brand-filtered page. */
const MAX_SCAN_PER_PAGE = 500;
/** Upper bound on documents read for an export. */
export const MAX_EXPORT_LOGS = 5000;

const localDayStart = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const localDayEnd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

/** Firestore constraints for a user's logs (newest first) under `filters`, excluding brand. */
export function logQueryConstraints(userId: string, filters: LogFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [where('userId', '==', userId), orderBy('timestamp', 'desc')];
  if (filters.vehicleId) c.push(where('vehicleId', '==', filters.vehicleId));
  if (filters.startDate) c.push(where('timestamp', '>=', Timestamp.fromDate(localDayStart(filters.startDate))));
  if (filters.endDate) c.push(where('timestamp', '<=', Timestamp.fromDate(localDayEnd(filters.endDate))));
  return c;
}

const isRealBrand = (b?: string) => !!b && b.trim() !== '' && b.trim().toLowerCase() !== 'unknown';

/**
 * Fetches one page of logs. With a brand filter it keeps reading raw pages
 * until it has `pageSize` matches or runs out, so a filter that matches
 * nothing on the first raw page no longer looks like "no more logs".
 */
export async function fetchLogsPage(
  userId: string,
  filters: LogFilters,
  cursor: LogCursor | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<LogsPage> {
  const base = logQueryConstraints(userId, filters);
  const logs: Log[] = [];
  const brands = new Set<string>();
  let next: LogCursor | null = cursor;
  let scanned = 0;

  for (;;) {
    const constraints = [...base, ...(next ? [startAfter(next)] : []), limit(pageSize)];
    const snap = await getDocs(query(collection(db, 'fuelLogs'), ...constraints));
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i++) {
      const log = withId(fuelLogSchema, 'fuelLog', docs[i]) as Log;
      if (isRealBrand(log.brand)) brands.add(log.brand!.trim());
      if (!filters.brand || log.brand === filters.brand) {
        logs.push(log);
        if (logs.length >= pageSize) {
          // Page is full mid-batch: resume right after this document.
          const more = i < docs.length - 1 || docs.length === pageSize;
          return { logs, nextCursor: more ? docs[i] : null, brands: [...brands] };
        }
      }
    }

    scanned += docs.length;
    const exhausted = docs.length < pageSize;
    next = docs.length ? docs[docs.length - 1] : next;
    if (exhausted) return { logs, nextCursor: null, brands: [...brands] };
    if (!filters.brand || scanned >= MAX_SCAN_PER_PAGE) {
      return { logs, nextCursor: next, brands: [...brands] };
    }
  }
}

/**
 * Every log matching `filters` (up to MAX_EXPORT_LOGS), for exports — not
 * just the pages currently loaded on screen.
 */
export async function fetchAllLogs(userId: string, filters: LogFilters): Promise<{ logs: Log[]; truncated: boolean }> {
  const all: Log[] = [];
  let cursor: LogCursor | null = null;
  for (;;) {
    const page = await fetchLogsPage(userId, filters, cursor, 200);
    all.push(...page.logs);
    if (all.length >= MAX_EXPORT_LOGS) return { logs: all.slice(0, MAX_EXPORT_LOGS), truncated: true };
    if (!page.nextCursor) return { logs: all, truncated: false };
    cursor = page.nextCursor;
  }
}

/**
 * Distinct brands from the user's most recent logs, for autocomplete.
 * Bounded: the previous implementation downloaded every log the user had.
 */
export async function fetchRecentBrands(userId: string, recent = 200): Promise<string[]> {
  const snap = await getDocs(query(
    collection(db, 'fuelLogs'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(recent),
  ));
  const brands = new Set<string>();
  snap.docs.forEach(d => {
    const brand = (d.data() as { brand?: string }).brand;
    if (isRealBrand(brand)) brands.add(brand!.trim());
  });
  return [...brands].sort((a, b) => a.localeCompare(b));
}

/** How many logs reference a vehicle (server count; needs a connection). */
export async function countVehicleLogs(userId: string, vehicleId: string): Promise<number> {
  const snap = await getCountFromServer(query(
    collection(db, 'fuelLogs'), where('userId', '==', userId), where('vehicleId', '==', vehicleId),
  ));
  return snap.data().count;
}

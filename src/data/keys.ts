// Query keys for the TanStack Query cache, in one place so mutations can
// invalidate exactly what they affect.
//
// Everything derived from `fuelLogs` (History pages, brands, odometer,
// dashboard window, lifetime and per-vehicle stats) lives under
// ['logs', uid], so a log write invalidates all of it with one call.
import type { LogFilters } from './logs';

export const logKeys = {
  all: (uid: string | undefined) => ['logs', uid] as const,
  list: (uid: string | undefined, filters: LogFilters) => ['logs', uid, 'list', filters] as const,
  recentBrands: (uid: string | undefined) => ['logs', uid, 'recentBrands'] as const,
  lastOdometer: (uid: string | undefined, vehicleId: string, beforeMs: number) =>
    ['logs', uid, 'lastOdometer', vehicleId, beforeMs] as const,
  since: (uid: string | undefined, sinceMs: number, vehicleId: string | undefined) =>
    ['logs', uid, 'since', { sinceMs, vehicleId: vehicleId ?? null }] as const,
  lifetimeStats: (uid: string | undefined, vehicleId: string | undefined) =>
    ['logs', uid, 'lifetimeStats', vehicleId ?? null] as const,
  vehicleComparison: (uid: string | undefined, vehicleIds: string[]) =>
    ['logs', uid, 'vehicleComparison', vehicleIds] as const,
};

export const vehicleKeys = {
  all: (uid: string | undefined) => ['vehicles', uid] as const,
  list: (uid: string | undefined, includeArchived: boolean) =>
    ['vehicles', uid, { includeArchived }] as const,
};

// React Query hooks for dashboard statistics. Keys live under ['logs', uid],
// so any log mutation refreshes them.
import { useQuery } from '@tanstack/react-query';
import { logKeys } from './keys';
import { fetchVehicleComparison, getLifetimeStats } from './stats';
import type { Vehicle } from '../utils/types';

/** Lifetime totals (server-side aggregation), for all vehicles or one. */
export function useLifetimeStats(userId: string | undefined, vehicleId?: string) {
  return useQuery({
    queryKey: logKeys.lifetimeStats(userId, vehicleId),
    queryFn: () => getLifetimeStats(userId!, vehicleId),
    enabled: !!userId,
  });
}

/** Per-vehicle comparison rows; empty unless two or more vehicles have logs. */
export function useVehicleComparison(userId: string | undefined, vehicles: Vehicle[]) {
  return useQuery({
    queryKey: logKeys.vehicleComparison(userId, vehicles.map(v => v.id)),
    queryFn: () => fetchVehicleComparison(userId!, vehicles),
    enabled: !!userId && vehicles.length >= 2,
  });
}

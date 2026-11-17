// React Query hooks for fuel logs. Log mutations invalidate everything under
// ['logs', uid] (History lists, brands, odometer, dashboard and stats).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLastOdometerReading } from '../firebase/firestoreService';
import { logKeys } from './keys';
import { addLog, deleteLog, fetchLogsSince, fetchRecentBrands, updateLog, type NewFuelLog } from './logs';
import type { FuelLogData } from '../utils/types';

/** Distinct recent brands, for the brand autocomplete. */
export function useRecentBrands(userId: string | undefined) {
  return useQuery({
    queryKey: logKeys.recentBrands(userId),
    queryFn: () => fetchRecentBrands(userId!),
    enabled: !!userId,
  });
}

/**
 * The closest odometer reading before `before` for a vehicle. Keeps showing
 * the previous answer while a new vehicle/date is fetched, so the hint and
 * the derived distance don't flicker.
 */
export function useLastOdometerReading(userId: string | undefined, vehicleId: string, before: Date) {
  const beforeMs = before.getTime();
  return useQuery({
    queryKey: logKeys.lastOdometer(userId, vehicleId, beforeMs),
    queryFn: () => getLastOdometerReading(vehicleId, new Date(beforeMs)),
    enabled: !!userId && !!vehicleId,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Logs since `since` (the dashboard's window), optionally for one vehicle. */
export function useLogsSince(userId: string | undefined, since: Date, vehicleId?: string) {
  const sinceMs = since.getTime();
  return useQuery({
    queryKey: logKeys.since(userId, sinceMs, vehicleId),
    queryFn: () => fetchLogsSince(userId!, new Date(sinceMs), vehicleId),
    enabled: !!userId,
  });
}

function useInvalidateLogs(userId: string | undefined) {
  const queryClient = useQueryClient();
  // Not awaited: the mutation settles as soon as the write does (or, offline,
  // as soon as it is queued); dependent views refetch in the background.
  return () => { void queryClient.invalidateQueries({ queryKey: logKeys.all(userId) }); };
}

/** Adds a log; resolves with `savedOffline` instead of waiting for the server offline. */
export function useAddLog(userId: string | undefined) {
  const invalidate = useInvalidateLogs(userId);
  return useMutation({
    mutationFn: (log: NewFuelLog) => addLog(log),
    // Never pause offline: addLog queues the write and resolves right away.
    networkMode: 'always',
    onSuccess: invalidate,
  });
}

export function useUpdateLog(userId: string | undefined) {
  const invalidate = useInvalidateLogs(userId);
  return useMutation({
    mutationFn: ({ logId, updates }: { logId: string; updates: Partial<FuelLogData> }) => updateLog(logId, updates),
    onSuccess: invalidate,
  });
}

export function useDeleteLog(userId: string | undefined) {
  const invalidate = useInvalidateLogs(userId);
  return useMutation({ mutationFn: (logId: string) => deleteLog(logId), onSuccess: invalidate });
}

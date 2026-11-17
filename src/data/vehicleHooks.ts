// React Query hooks for vehicles. Every mutation invalidates the user's
// vehicle lists so every page (QuickLog, History, Dashboard, Profile) agrees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from './keys';
import {
  addVehicle, deleteVehicle, fetchVehicles, setDefaultVehicle, toggleArchiveVehicle,
  type NewVehicleInput,
} from './vehicles';
import type { Vehicle } from '../utils/types';

/** The user's vehicles, sorted by name; archived ones only with `includeArchived`. */
export function useVehicles(userId: string | undefined, { includeArchived = false } = {}) {
  return useQuery({
    queryKey: vehicleKeys.list(userId, includeArchived),
    queryFn: () => fetchVehicles(userId!, { includeArchived }),
    enabled: !!userId,
  });
}

function useInvalidateVehicles(userId: string | undefined) {
  const queryClient = useQueryClient();
  // Not awaited: the mutation settles as soon as the write does.
  return () => { void queryClient.invalidateQueries({ queryKey: vehicleKeys.all(userId) }); };
}

export function useAddVehicle(userId: string | undefined) {
  const invalidate = useInvalidateVehicles(userId);
  return useMutation({
    mutationFn: ({ input, existing }: { input: NewVehicleInput; existing: Vehicle[] }) =>
      addVehicle(userId!, input, existing),
    onSuccess: invalidate,
  });
}

export function useSetDefaultVehicle(userId: string | undefined) {
  const invalidate = useInvalidateVehicles(userId);
  return useMutation({
    mutationFn: ({ vehicle, all }: { vehicle: Vehicle; all: Vehicle[] }) => setDefaultVehicle(vehicle, all),
    onSuccess: invalidate,
  });
}

export function useToggleArchiveVehicle(userId: string | undefined) {
  const invalidate = useInvalidateVehicles(userId);
  return useMutation({
    mutationFn: (vehicle: Vehicle) => toggleArchiveVehicle(vehicle),
    onSuccess: invalidate,
  });
}

export function useDeleteVehicle(userId: string | undefined) {
  const invalidate = useInvalidateVehicles(userId);
  return useMutation({
    mutationFn: (vehicleId: string) => deleteVehicle(userId!, vehicleId),
    onSuccess: (result) => { if (result.deleted) invalidate(); },
  });
}

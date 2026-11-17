// Vehicle reads and writes. Pure Firestore access (no React); the React
// Query hooks live in vehicleHooks.ts.
import { collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchVehicles, pickDefaultVehicle } from '../firebase/firestoreService';
import { countVehicleLogs } from './logs';
import type { Vehicle, VehicleFuelType } from '../utils/types';

export { fetchVehicles, pickDefaultVehicle };

/** The add-vehicle form's values, written as-is. */
export interface NewVehicleInput {
  name: string;
  make: string;
  model: string;
  year: string;
  fuelType: VehicleFuelType;
  isDefault: boolean;
}

/**
 * Adds a vehicle. One atomic batch clears the old default and adds the new
 * vehicle together, so a failure can't leave the user with no default. The
 * first active vehicle always becomes the default.
 */
export async function addVehicle(userId: string, input: NewVehicleInput, existing: Vehicle[]): Promise<void> {
  const isDefault = existing.filter(v => !v.isArchived).length === 0 ? true : input.isDefault;
  const batch = writeBatch(db);
  if (isDefault) {
    existing.forEach(v => {
      if (v.isDefault) batch.update(doc(db, 'vehicles', v.id), { isDefault: false });
    });
  }
  batch.set(doc(collection(db, 'vehicles')), { ...input, userId, isArchived: false, isDefault });
  await batch.commit();
}

/** Makes `vehicle` the only default among `all`. Archived vehicles can't be the default. */
export async function setDefaultVehicle(vehicle: Vehicle, all: Vehicle[]): Promise<void> {
  if (vehicle.isArchived) return;
  const batch = writeBatch(db);
  all.forEach(v => batch.update(doc(db, 'vehicles', v.id), { isDefault: v.id === vehicle.id }));
  await batch.commit();
}

/** Archives or restores a vehicle. Archiving the default also clears its default flag. */
export async function toggleArchiveVehicle(vehicle: Vehicle): Promise<void> {
  const isArchived = !vehicle.isArchived;
  const updates: { isArchived: boolean; isDefault?: boolean } = { isArchived };
  if (isArchived && vehicle.isDefault) updates.isDefault = false;
  await updateDoc(doc(db, 'vehicles', vehicle.id), updates);
}

export type DeleteVehicleResult = { deleted: true } | { deleted: false; logCount: number };

/**
 * Deletes a vehicle unless it has logs: deleting one with logs would orphan
 * them, so the caller should offer archiving instead.
 */
export async function deleteVehicle(userId: string, vehicleId: string): Promise<DeleteVehicleResult> {
  const logCount = await countVehicleLogs(userId, vehicleId);
  if (logCount > 0) return { deleted: false, logCount };
  await deleteDoc(doc(db, 'vehicles', vehicleId));
  return { deleted: true };
}

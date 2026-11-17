import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  useAddVehicle, useDeleteVehicle, useSetDefaultVehicle, useToggleArchiveVehicle, useVehicles,
} from '../data/vehicleHooks';
import type { NewVehicleInput } from '../data/vehicles';
import type { Vehicle } from '../utils/types';
import ApiTokenManager from '../components/ApiTokenManager';
import AppPreferencesSection from '../components/profile/AppPreferencesSection';
import VehicleFleetSection from '../components/profile/VehicleFleetSection';
import AddVehicleForm from '../components/profile/AddVehicleForm';
import NotificationsSection from '../components/profile/NotificationsSection';
import DataImportSection from '../components/profile/DataImportSection';
import MaintenanceSection from '../components/profile/MaintenanceSection';
import type { StatusMessage } from '../components/profile/StatusBanner';

const NO_VEHICLES: Vehicle[] = [];
const isPermissionDenied = (err: unknown) => (err as { code?: string })?.code === 'permission-denied';

function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const uid = user?.uid;
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const vehiclesQuery = useVehicles(uid, { includeArchived: true });
  const vehicles = vehiclesQuery.data ?? NO_VEHICLES;
  const addVehicle = useAddVehicle(uid);
  const deleteVehicle = useDeleteVehicle(uid);
  const toggleArchive = useToggleArchiveVehicle(uid);
  const setDefault = useSetDefaultVehicle(uid);

  const handleAddVehicle = async (input: NewVehicleInput): Promise<boolean> => {
    if (!user) return false;
    setMessage(null);
    try {
      await addVehicle.mutateAsync({ input, existing: vehicles });
      setMessage({ type: 'success', text: t('profile.messages.vehicleAdded') });
      return true;
    } catch (err) {
      console.error("Error adding vehicle:", err);
      setMessage({ type: 'error', text: isPermissionDenied(err) ? t('profile.messages.permissionDenied') : t('profile.messages.failedToAdd') });
      return false;
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!user || !window.confirm(t('profile.messages.deleteConfirm'))) return;
    try {
      // Deleting a vehicle that has logs would orphan them; archive instead.
      const result = await deleteVehicle.mutateAsync(id);
      if (!result.deleted) {
        setMessage({ type: 'error', text: t('profile.messages.vehicleHasLogs', { count: result.logCount, defaultValue: 'This vehicle has {{count}} fuel logs. Archive it instead to keep its history.' }) });
      }
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      setMessage({ type: 'error', text: isPermissionDenied(err) ? t('profile.messages.permissionDeniedDelete') : t('profile.messages.failedToDelete') });
    }
  };

  const handleArchiveVehicle = async (vehicle: Vehicle) => {
    try {
      await toggleArchive.mutateAsync(vehicle);
    } catch (err) {
      console.error("Error archiving vehicle:", err);
    }
  };

  const handleSetDefault = async (vehicle: Vehicle) => {
    if (vehicle.isArchived) return;
    try {
      await setDefault.mutateAsync({ vehicle, all: vehicles });
    } catch (err) {
      console.error("Error setting default vehicle:", err);
      setMessage({ type: 'error', text: isPermissionDenied(err) ? t('profile.messages.permissionDeniedDefault') : t('profile.messages.failedToSetDefault') });
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 space-y-10 pb-12 text-gray-900 dark:text-gray-100">
      <AppPreferencesSection />
      <VehicleFleetSection
        vehicles={vehicles}
        isLoading={!!uid && vehiclesQuery.isPending}
        onSetDefault={handleSetDefault}
        onToggleArchive={handleArchiveVehicle}
        onDelete={handleDeleteVehicle}
      />
      <AddVehicleForm onAdd={handleAddVehicle} isSaving={addVehicle.isPending} message={message} />
      <NotificationsSection />
      <DataImportSection />
      <ApiTokenManager />
      <MaintenanceSection />
    </div>
  );
}

export default ProfilePage;

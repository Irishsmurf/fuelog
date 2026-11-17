// Active and archived vehicle grids.
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Car } from 'lucide-react';
import type { Vehicle } from '../../utils/types';
import VehicleCard from './VehicleCard';

interface Props {
  vehicles: Vehicle[];
  isLoading: boolean;
  onSetDefault: (v: Vehicle) => void;
  onToggleArchive: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

export default function VehicleFleetSection({ vehicles, isLoading, ...actions }: Props): JSX.Element {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const activeVehicles = vehicles.filter(v => !v.isArchived);
  const archivedVehicles = vehicles.filter(v => v.isArchived);
  const card = (v: Vehicle) => <VehicleCard key={v.id} vehicle={v} {...actions} />;

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white">{t('profile.vehicleFleet')}</h2>
          <p className="text-sm font-medium text-gray-500">{t('profile.vehicleFleetSubtext')}</p>
        </div>
        {archivedVehicles.length > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:underline"
          >
            {showArchived ? t('profile.hideArchived') : t('profile.showArchived', { count: archivedVehicles.length })}
          </button>
        )}
      </div>

      {/* Active Vehicle Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl"></div>)}
          </div>
        ) : activeVehicles.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-12 text-center">
            <div className="bg-gray-50 dark:bg-gray-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Car size={32} />
            </div>
            <p className="text-gray-500 font-bold">{t('profile.noActiveVehicles')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('profile.noActiveVehiclesSubtext')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeVehicles.map(card)}
          </div>
        )}
      </div>

      {/* Archived Vehicle Grid */}
      {showArchived && archivedVehicles.length > 0 && (
        <div className="mt-10 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4 flex items-center">
            <Archive size={14} className="mr-2" /> {t('profile.archivedFleet')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
            {archivedVehicles.map(card)}
          </div>
        </div>
      )}
    </div>
  );
}

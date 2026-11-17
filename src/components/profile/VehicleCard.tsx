import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Car, CheckCircle2, Trash2 } from 'lucide-react';
import type { Vehicle } from '../../utils/types';

interface Props {
  vehicle: Vehicle;
  onSetDefault: (v: Vehicle) => void;
  onToggleArchive: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

export default function VehicleCard({ vehicle: v, onSetDefault, onToggleArchive, onDelete }: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className={`group relative bg-white dark:bg-gray-800 rounded-xl border transition-all duration-300 overflow-hidden ${v.isDefault ? 'border-brand-primary' : 'border-gray-200 dark:border-gray-700/60'}`}>
      <div className="p-5 flex items-start space-x-4">
        {/* Car Icon Accent */}
        <div className={`p-3 rounded-xl transition-colors ${v.isDefault ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-50 dark:bg-gray-900 text-gray-400'}`}>
          <Car size={24} />
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="text-lg font-semibold tracking-tight truncate text-gray-900 dark:text-white">{v.name}</h4>
            {v.isDefault && (
              <span className="nocturne-tag shrink-0">
                {t('profile.vehicleCard.primary')}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">{v.make} • {v.model}</p>

          <div className="flex items-center space-x-3 mt-3">
            <div className="flex items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-indigo-400 mr-1.5"></span>
              {v.year}
            </div>
            <div className="flex items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${v.fuelType === 'Electric' ? 'bg-green-400' : 'bg-amber-400'}`}></span>
              {v.fuelType}
            </div>
          </div>
        </div>
      </div>

      {/* Action Overlay/Bar */}
      <div className="flex border-t border-gray-50 dark:border-gray-700 divide-x divide-gray-50 dark:divide-gray-700">
        {!v.isArchived && !v.isDefault && (
          <button
            onClick={() => onSetDefault(v)}
            className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-brand-primary hover:bg-brand-primary/5 transition-all flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 size={12} />
            <span>{t('profile.vehicleCard.makeDefault')}</span>
          </button>
        )}
        <button
          onClick={() => onToggleArchive(v)}
          className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all flex items-center justify-center space-x-1.5"
          title={v.isArchived ? t('profile.vehicleCard.restore') : t('profile.vehicleCard.archive')}
        >
          <Archive size={12} />
          <span>{v.isArchived ? t('profile.vehicleCard.restore') : t('profile.vehicleCard.archive')}</span>
        </button>
        <button
          onClick={() => onDelete(v.id)}
          className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center space-x-1.5"
        >
          <Trash2 size={12} />
          <span>{t('profile.vehicleCard.delete')}</span>
        </button>
      </div>
    </div>
  );
}

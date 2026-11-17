// Vehicle picker (segmented for up to three vehicles, a select beyond) and
// the filling-station / brand field with autocomplete.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../../utils/types';

interface Props {
  vehicles: Vehicle[];
  vehicleId: string;
  onVehicleChange: (id: string) => void;
  brand: string;
  onBrandChange: (brand: string) => void;
  knownBrands: string[];
  isSaving: boolean;
  isLoadingBrands: boolean;
}

export default function VehicleAndBrandFields(p: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={p.vehicles.length > 3 ? 'vehicle' : undefined} className="nocturne-label">{t('quickLog.fields.vehicle')}</label>
        {p.vehicles.length <= 3 ? (
          <div className="nocturne-seg" role="radiogroup" aria-label={t('quickLog.fields.vehicle')}>
            {p.vehicles.map((v) => (
              <label key={v.id} className="nocturne-seg-opt relative">
                <input
                  type="radio"
                  name="vehicle"
                  value={v.id}
                  checked={p.vehicleId === v.id}
                  onChange={() => p.onVehicleChange(v.id)}
                  disabled={p.isSaving}
                />
                {v.name}
              </label>
            ))}
          </div>
        ) : (
          <div className="relative">
            <select id="vehicle" value={p.vehicleId} onChange={(e) => p.onVehicleChange(e.target.value)} className="nocturne-input appearance-none cursor-pointer" disabled={p.isSaving}>
              {p.vehicles.map((v) => ( <option key={v.id} value={v.id}>{v.name} ({v.make})</option> ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="brand" className="nocturne-label flex items-center justify-between">
          <span>{t('quickLog.fields.fillingStation')}</span>
          <span className="text-gray-400 dark:text-gray-500 font-normal">{t('quickLog.fields.fillingStationOptional')}</span>
        </label>
        <input type="text" id="brand" value={p.brand} onChange={(e) => p.onBrandChange(e.target.value)} placeholder={t('quickLog.fields.fillingStationPlaceholder')} className="nocturne-input" disabled={p.isSaving || p.isLoadingBrands} list="brand-suggestions" autoComplete="off" />
        <datalist id="brand-suggestions">{p.knownBrands.map((b) => ( <option key={b} value={b} /> ))}</datalist>
      </div>
    </div>
  );
}

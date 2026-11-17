// "Location" card: current fix / pinned station, plus the map picker.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import LocationPicker from '../LocationPicker';
import type { LocationPinState } from '../../hooks/useLocationPin';

export default function LocationSection({ pin, isSaving }: { pin: LocationPinState; isSaving: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { location, locationMode, matchedStation } = pin;
  const coords = location ? { latitude: location.latitude, longitude: location.longitude } : null;

  return (
    <div className="nocturne-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('quickLog.sections.location', { defaultValue: 'Location' })}</span>
        <button
          type="button"
          onClick={() => pin.setShowMap(s => !s)}
          disabled={isSaving}
          className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-brand-primary-hover dark:hover:text-brand-primary disabled:opacity-50"
        >
          {pin.showMap
            ? t('quickLog.location.hideMap', { defaultValue: 'Hide map' })
            : t('quickLog.location.adjustOnMap', { defaultValue: 'Adjust on map' })}
        </button>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2 flex-wrap">
        {pin.isResolvingStation ? (
          <span className="flex items-center gap-1.5 text-gray-500">
            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            {t('quickLog.location.resolving', { defaultValue: 'Finding nearest station…' })}
          </span>
        ) : location ? (
          <>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {matchedStation
                ? matchedStation.name
                : t('quickLog.location.coords', {
                    lat: location.latitude.toFixed(4),
                    lng: location.longitude.toFixed(4),
                    defaultValue: '{{lat}}, {{lng}}',
                  })}
            </span>
            <span className={`font-bold uppercase ${locationMode === 'manual' ? 'nocturne-tag' : 'nocturne-tag-neutral'}`}>
              {locationMode === 'manual'
                ? t('quickLog.location.manualBadge', { defaultValue: 'Pinned' })
                : t('quickLog.location.gpsBadge', { defaultValue: 'GPS' })}
            </span>
          </>
        ) : (
          <span className="text-gray-500">{t('quickLog.location.none', { defaultValue: 'No location yet — adjust on map to set one.' })}</span>
        )}
      </div>

      {pin.showMap && (
        <LocationPicker value={coords} onChange={pin.handlePinChange} defaultCenter={coords ?? undefined} />
      )}
    </div>
  );
}

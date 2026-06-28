// src/components/LocationPicker.tsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

import { MAP_TILES } from '../utils/mapConstants';
import { getCurrentPosition } from '../utils/locationService';
import { useTheme } from '../context/ThemeContext';

// --- Default marker icon fix (points to public assets) ---
// Mirrors the fix in FuelMapPage so the marker renders when this component is
// mounted independently of the map page.
const iconRetinaUrl = '/marker-icon-2x.png';
const iconUrl = '/marker-icon.png';
const shadowUrl = '/marker-shadow.png';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
// --- End Icon Fix ---

export interface PickerCoords {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  value: PickerCoords | null;
  onChange: (coords: PickerCoords) => void;
  /** Where to centre the map when there's no value yet. Defaults to Dublin. */
  defaultCenter?: PickerCoords;
  className?: string;
}

const DUBLIN: PickerCoords = { latitude: 53.3498, longitude: -6.2603 };

// Recentres the map whenever the selected coordinates change from outside
// (e.g. a receipt-geocoded address or "use my current location").
const RecenterOnChange: React.FC<{ coords: PickerCoords | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView([coords.latitude, coords.longitude], Math.max(map.getZoom(), 15));
    }
    // Depend on primitive lat/lng, not the object reference: parents recreate the
    // coords object on every render, which would otherwise re-centre (snap back)
    // the map whenever any other form field changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude, map]);
  return null;
};

// Places/moves the pin on map click.
const ClickToPlace: React.FC<{ onChange: (coords: PickerCoords) => void }> = ({ onChange }) => {
  useMapEvents({
    click(e) {
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, defaultCenter, className }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);

  const center = value ?? defaultCenter ?? DUBLIN;

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      if (pos) {
        onChange({ latitude: pos.latitude, longitude: pos.longitude });
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className={className}>
      <div className="relative h-56 w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner">
        <MapContainer
          center={[center.latitude, center.longitude]}
          zoom={value ? 15 : 11}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={MAP_TILES.attribution}
            url={theme === 'dark' ? MAP_TILES.dark : MAP_TILES.light}
          />
          <ClickToPlace onChange={onChange} />
          <RecenterOnChange coords={value} />
          {value && (
            <Marker
              position={[value.latitude, value.longitude]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  onChange({ latitude: lat, longitude: lng });
                },
              }}
            />
          )}
        </MapContainer>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="absolute z-[1000] bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-300 dark:border-gray-600 shadow-md text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
        >
          {locating
            ? <Loader className="w-3.5 h-3.5 animate-spin" />
            : <Navigation className="w-3.5 h-3.5" />}
          {t('locationPicker.useCurrentLocation', 'Use my location')}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {value
          ? t('locationPicker.coords', '{{lat}}, {{lng}} — tap or drag the pin to adjust', {
              lat: value.latitude.toFixed(5),
              lng: value.longitude.toFixed(5),
            })
          : t('locationPicker.tapToPlace', 'Tap the map to drop a pin where you fuelled.')}
      </p>
    </div>
  );
};

export default LocationPicker;

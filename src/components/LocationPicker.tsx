// src/components/LocationPicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { MapMouseEvent, Marker as MapLibreMarker } from 'maplibre-gl';
import { Navigation, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import maplibregl from './map/maplibre';
import { useMapLibre } from './map/useMapLibre';
import { getCurrentPosition } from '../utils/locationService';

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

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, defaultCenter, className }) => {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);

  const center = value ?? defaultCenter ?? DUBLIN;
  const { containerRef, map } = useMapLibre({
    center: [center.longitude, center.latitude],
    zoom: value ? 15 : 11,
  });

  // Map handlers outlive a render; always call the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Primitive lat/lng rather than the object: parents recreate the coords
  // object on every render, which would otherwise re-centre (snap back) the
  // map whenever any other form field changes.
  const lat = value?.latitude;
  const lng = value?.longitude;

  useEffect(() => {
    if (!map) return;
    const control = new maplibregl.NavigationControl({ showCompass: false });
    map.addControl(control, 'top-left');
    // Places/moves the pin on map click.
    const onClick = (e: MapMouseEvent) => {
      onChangeRef.current({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
      // map.remove() (the map unmounting first) already detached it.
      if (map.hasControl(control)) map.removeControl(control);
    };
  }, [map]);

  // Recentres the map whenever the selected coordinates change from outside
  // (e.g. a receipt-geocoded address or "use my current location").
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    map.jumpTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
  }, [map, lat, lng]);

  // The draggable pin, present only while there is a value.
  const markerRef = useRef<MapLibreMarker | null>(null);
  const hasValue = lat !== undefined && lng !== undefined;
  useEffect(() => {
    if (!map || !hasValue) return;
    const marker = new maplibregl.Marker({ draggable: true });
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      onChangeRef.current({ latitude: pos.lat, longitude: pos.lng });
    });
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, hasValue]);

  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    markerRef.current?.setLngLat([lng, lat]).addTo(map);
  }, [map, lat, lng]);

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
        <div ref={containerRef} data-testid="location-picker-map" className="h-full w-full" />

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="absolute z-10 bottom-8 right-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-300 dark:border-gray-600 shadow-md text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
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

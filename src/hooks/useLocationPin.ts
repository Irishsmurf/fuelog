// The Quick Log location: GPS by default, or a pin the user places on a map.
//
// Location is resolved into state (rather than grabbed inline at submit) so
// the user can review it and override it on a map before saving. This fixes
// late entries getting the submission-time location instead of the fuelling
// location.
import { Dispatch, SetStateAction, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { findNearestStation } from '../utils/locationService';
import type { PickerCoords } from '../components/LocationPicker';
import type { LocationData, LocationMode } from '../components/quicklog/types';

interface Options {
  setBrand: Dispatch<SetStateAction<string>>;
  setStationWarning: (text: string) => void;
  t: TFunction;
}

export function useLocationPin({ setBrand, setStationWarning, t }: Options) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>('gps');
  const [showMap, setShowMap] = useState<boolean>(false);

  // --- Station preview for a MANUAL pin ---
  // A manually placed pin is authoritative (no GPS accuracy gate). This is
  // read-only (Overpass); the station document is only created at submit
  // time. GPS-mode location is resolved at submit, keeping the fast at-pump
  // path unchanged. Keyed by the pin, so a superseded lookup is ignored.
  const manualPin = locationMode === 'manual' ? location : null;
  const stationQuery = useQuery({
    queryKey: ['nearestStation', manualPin?.latitude, manualPin?.longitude],
    queryFn: () => findNearestStation(manualPin!.latitude, manualPin!.longitude),
    enabled: !!manualPin,
    retry: false,
    gcTime: 0,
  });
  const matchedStation = manualPin ? stationQuery.data ?? null : null;

  // React to each lookup result once (state adjusted during render, not in an effect).
  const [handledAt, setHandledAt] = useState(0);
  const resultAt = Math.max(stationQuery.dataUpdatedAt, stationQuery.errorUpdatedAt);
  if (manualPin && !stationQuery.isFetching && resultAt !== handledAt) {
    setHandledAt(resultAt);
    if (stationQuery.isError) {
      console.error('Station lookup failed:', stationQuery.error);
      setStationWarning(t('quickLog.messages.stationLookupWarning'));
    } else if (stationQuery.data) {
      const name = stationQuery.data.name;
      // Only auto-fill an empty brand; never clobber what the user typed.
      setBrand(prev => prev.trim() ? prev : name);
    }
  }

  /** The user dropped or moved the pin. */
  const handlePinChange = (coords: PickerCoords) => {
    setLocation({ latitude: coords.latitude, longitude: coords.longitude });
    setLocationMode('manual');
    setStationWarning('');
  };

  /** Pins a location found elsewhere (e.g. a geocoded receipt address) and shows it. */
  const pinAndShow = (coords: PickerCoords) => {
    handlePinChange(coords);
    setShowMap(true);
  };

  const reset = () => {
    setLocation(null);
    setLocationMode('gps');
    setShowMap(false);
  };

  return {
    location, locationMode, showMap, setShowMap, matchedStation,
    isResolvingStation: !!manualPin && stationQuery.isFetching,
    handlePinChange, pinAndShow, reset,
  };
}

export type LocationPinState = ReturnType<typeof useLocationPin>;

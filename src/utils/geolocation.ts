import type { LocationData } from '../components/quicklog/types';

/** A fresh high-accuracy GPS fix, or null when unsupported, denied or timed out. */
export function getCurrentLocation(): Promise<LocationData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationAccuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.warn(`Geolocation error (${error.code}): ${error.message}`);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

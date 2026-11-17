/**
 * Location Service for finding petrol stations using OpenStreetMap (Overpass API).
 */

import { overpassFuelQuery, pickNearestStation, type OSMStation, type OverpassElement } from '@fuelog/core';

export type { OSMStation };
export { haversineDistanceKm } from '@fuelog/core';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * GPS accuracy (in metres) beyond which we no longer trust a position
 * fix to reliably resolve the correct nearby station.
 */
export const GPS_ACCURACY_THRESHOLD_METERS = 100;

/**
 * Whether a GPS fix is accurate enough to attempt automatic station matching.
 */
export function isAccurateEnoughForStationMatch(locationAccuracy: number): boolean {
    return locationAccuracy <= GPS_ACCURACY_THRESHOLD_METERS;
}

export interface Coordinates {
    latitude: number;
    longitude: number;
}

/**
 * Resolves the browser's current position for rough proximity sorting.
 * Never rejects: resolves null if geolocation is unsupported, denied, or errors.
 */
export function getCurrentPosition(): Promise<Coordinates | null> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                console.warn(`Geolocation error (${error.code}): ${error.message}`);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

/**
 * Forward-geocode a free-text address (or station name) into coordinates using
 * OpenStreetMap's Nominatim service. Best-effort: resolves null when nothing
 * matches or the request fails, so callers can fall back to GPS/defaults.
 *
 * Used to guess a sensible default map pin from a receipt's printed address
 * when logging a fuelling after the fact.
 */
export async function geocodeAddress(query: string): Promise<Coordinates | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;

    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;

    try {
        const response = await fetch(url, {
            headers: {
                // Nominatim's usage policy asks for an identifying request; the
                // browser sets User-Agent automatically, so we send Accept only.
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`Nominatim responded with status ${response.status}`);
            return null;
        }

        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) return null;

        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

        return { latitude: lat, longitude: lon };
    } catch (error) {
        console.warn('Nominatim geocoding failed:', error);
        return null;
    }
}

/**
 * Find the nearest petrol station within a radius (default 150m) of the given coordinates.
 */
export async function findNearestStation(lat: number, lon: number, radiusMeters: number = 150): Promise<OSMStation | null> {
    const query = overpassFuelQuery(lat, lon, radiusMeters);

    let retries = 0;
    const maxRetries = 3;
    let delay = 2000; // Start with 2s delay for retry

    while (retries < maxRetries) {
        try {
            const response = await fetch(OVERPASS_URL, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (response.status === 429) {
                console.warn(`Overpass API rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
                delay *= 2; // Exponential backoff
                continue;
            }

            if (!response.ok) {
                throw new Error(`Overpass API responded with status ${response.status}`);
            }

            const data = await response.json();
            const elements: OverpassElement[] = data.elements || [];
            return pickNearestStation(elements, lat, lon);
        } catch (error) {
            // Propagate genuine lookup failures so callers can distinguish them
            // from the "no station nearby" case (which returns null above) and
            // surface a warning to the user.
            console.error('Error querying Overpass API:', error);
            throw error;
        }
    }

    console.error('Max retries reached for Overpass API.');
    throw new Error('Overpass API unavailable after maximum retries.');
}

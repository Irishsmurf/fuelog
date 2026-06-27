/**
 * Location Service for finding petrol stations using OpenStreetMap (Overpass API).
 */

export interface OSMStation {
    id: string;
    osmId: string;
    name: string;
    brand?: string;
    latitude: number;
    longitude: number;
    address?: string;
}

interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat: number;
    lon: number;
    tags?: {
        amenity?: string;
        name?: string;
        brand?: string;
        operator?: string;
        'addr:street'?: string;
        'addr:housenumber'?: string;
    };
    center?: {
        lat: number;
        lon: number;
    };
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two coordinates, in kilometres.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
 * Find the nearest petrol station within a radius (default 150m) of the given coordinates.
 */
export async function findNearestStation(lat: number, lon: number, radiusMeters: number = 150): Promise<OSMStation | null> {
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
          way["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
          relation["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
        );
        out body;
        >;
        out skel qt;
    `;

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

            if (elements.length === 0) {
                return null;
            }

            // Filter for elements that have tags (the main station objects)
            const stations = elements.filter((el) => el.tags && el.tags.amenity === 'fuel');

            if (stations.length === 0) {
                return null;
            }

            // Sort by distance (simplistic calculation as it's a small radius)
            const sorted = stations.sort((a, b) => {
                const distA = Math.pow(a.lat - lat, 2) + Math.pow(a.lon - lon, 2);
                const distB = Math.pow(b.lat - lat, 2) + Math.pow(b.lon - lon, 2);
                return distA - distB;
            });

            const best = sorted[0];
            
            // Extract lat/lon for ways/relations if they don't have them directly
            let finalLat = best.lat;
            let finalLon = best.lon;

            if (best.type === 'way' || best.type === 'relation') {
                // For ways/relations, we take the center if available or just use the input lat/lon as fallback
                if (best.center) {
                    finalLat = best.center.lat;
                    finalLon = best.center.lon;
                } else {
                    finalLat = lat;
                    finalLon = lon;
                }
            }

            return {
                id: `${best.type}/${best.id}`,
                osmId: `${best.type}/${best.id}`,
                name: best.tags?.name || best.tags?.brand || 'Unknown Station',
                brand: best.tags?.brand || best.tags?.operator,
                latitude: finalLat,
                longitude: finalLon,
                address: best.tags?.['addr:street'] ? `${best.tags['addr:street']} ${best.tags['addr:housenumber'] || ''}`.trim() : undefined
            };
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

/**
 * Nearest-petrol-station lookup against OpenStreetMap's Overpass API: the
 * query and the pure selection of a result. No network or Firebase here, so
 * the web app and Cloud Functions resolve a coordinate to the same station;
 * each caller does its own fetch (browser vs server headers and retries).
 */

/** A petrol station resolved from OpenStreetMap. */
export interface OSMStation {
  id: string; // e.g. "node/123", the unique OSM identifier
  osmId: string;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

/** The raw shape Overpass returns for a single map element. */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: {
    amenity?: string;
    name?: string;
    brand?: string;
    operator?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
  };
  center?: { lat: number; lon: number };
}

/** Default search radius around a fill-up's coordinates, in metres. */
export const STATION_SEARCH_RADIUS_METERS = 150;

/** Overpass QL for every `amenity=fuel` feature within `radiusMeters` of (lat, lon). */
export function overpassFuelQuery(lat: number, lon: number, radiusMeters: number = STATION_SEARCH_RADIUS_METERS): string {
  return `
    [out:json][timeout:25];
    (
      node["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
      way["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
    );
    out body;
    >;
    out center qt;
  `;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Picks the closest fuel station among the elements Overpass returned around
 * (lat, lon), or null if none qualify. A way/relation has no coordinates of
 * its own, so its center is used, then the query point.
 */
export function pickNearestStation(elements: OverpassElement[], lat: number, lon: number): OSMStation | null {
  const stations = elements.filter((el) => el.tags?.amenity === 'fuel');
  if (stations.length === 0) return null;

  const coordsOf = (el: OverpassElement): { lat: number; lon: number } => {
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon };
    if (el.center) return { lat: el.center.lat, lon: el.center.lon };
    return { lat, lon };
  };
  const distanceOf = (el: OverpassElement) => {
    const c = coordsOf(el);
    return haversineDistanceKm(c.lat, c.lon, lat, lon);
  };

  const best = stations.reduce((closest, candidate) =>
    distanceOf(candidate) < distanceOf(closest) ? candidate : closest);

  const { lat: finalLat, lon: finalLon } = coordsOf(best);
  const street = best.tags?.['addr:street'];
  return {
    id: `${best.type}/${best.id}`,
    osmId: `${best.type}/${best.id}`,
    name: best.tags?.name || best.tags?.brand || 'Unknown Station',
    brand: best.tags?.brand || best.tags?.operator,
    latitude: finalLat,
    longitude: finalLon,
    address: street ? `${street} ${best.tags?.['addr:housenumber'] || ''}`.trim() : undefined,
  };
}

/**
 * Firestore document id of a station. OSM ids contain "/", a path separator
 * in Firestore, so it becomes "_".
 */
export function stationDocId(osmId: string): string {
  return osmId.replace(/\//g, '_');
}

/** The fields a new `stations` document is created with (legacy stats zeroed, as the rules require). */
export function newStationDoc(s: OSMStation) {
  return {
    osmId: s.osmId,
    name: s.name,
    brand: s.brand || '',
    latitude: s.latitude,
    longitude: s.longitude,
    address: s.address || '',
    logCount: 0,
    avgPrice: 0,
  };
}

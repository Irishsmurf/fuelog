import type { RequestParameters } from 'maplibre-gl';

/**
 * CARTO now stamps an "API KEY REQUIRED" watermark across keyless raster tiles,
 * and has said the raster endpoints are being retired in favour of vector.
 *
 * The key is deliberately shipped in the client bundle. Tiles are fetched by the
 * browser, so a key in a tile URL is visible in the network tab wherever it is
 * stored — it is an identifier, not a secret, the same posture as
 * VITE_FIREBASE_API_KEY. It is a free, no-account key with no payment method
 * attached, so the worst case if it is scraped is burning through CARTO's
 * 5M-requests/month fair-use limit, which throttles rather than bills.
 *
 * Absent, everything below degrades to the keyless endpoints: vector renders
 * clean, raster renders watermarked. That is what lets a fresh clone and CI run
 * without a secret.
 */
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY as string | undefined;

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Vector tiles overzoom cleanly well past the source data's zoom 14; 20 is
 * the value CARTO uses in its own examples for these styles.
 */
export const MAP_MAX_ZOOM = 20;

/**
 * Vector basemap styles — Positron for light, Dark Matter for dark, the vector
 * equivalents of the light_all/dark_all raster themes adopted in #140.
 */
export const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

/**
 * Matched on the parsed hostname rather than a substring of the whole URL. A
 * substring test would also match hosts that merely mention CARTO —
 * `https://evil.example/?r=cartocdn.com` or `https://cartocdn.com.evil.example`
 * — and the key would then be appended to a request bound for that host.
 */
const isCartoHost = (hostname: string): boolean =>
  hostname === 'cartocdn.com' || hostname.endsWith('.cartocdn.com');

/**
 * Appending `?key=` to a CARTO style.json does *not* propagate the key into the
 * source, glyph and sprite URLs the style references, so it has to be attached
 * per-request instead. MapLibre calls this for every resource it fetches, and
 * the style is fetched remotely, so treat the URLs it yields as untrusted.
 *
 * Returning undefined leaves the request untouched, which is both the no-key
 * path and the correct behaviour for any host that is not CARTO's.
 */
export const cartoTransformRequest = (url: string): RequestParameters | undefined => {
  if (!CARTO_API_KEY) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Relative or malformed; nothing we can safely attribute to CARTO.
    return undefined;
  }

  if (!isCartoHost(parsed.hostname)) return undefined;

  parsed.searchParams.set('key', CARTO_API_KEY);
  return { url: parsed.toString() };
};

// Lucide's "fuel" icon path data, inlined so map markers don't need a React
// render pass: map markers are plain DOM or style images, not React elements.
const FUEL_ICON_PATHS = `
  <line x1="3" x2="15" y1="22" y2="22"></line>
  <line x1="4" x2="14" y1="9" y2="9"></line>
  <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path>
  <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path>
`;

export const STATION_COLOR = '#f59e0b';
export const UNASSIGNED_STATION_COLOR = '#9ca3af';

/** Rendered size of a station marker, in CSS pixels. */
export const STATION_MARKER_SIZE = 28;

/**
 * A themed station marker as a standalone SVG: an amber disc (matching the
 * brand palette) with the same "fuel pump" glyph used for the Stations nav
 * item. `unassigned` renders a muted grey variant for logs with coordinates
 * but no associated Station document, so they remain visually distinct on
 * the map rather than looking like a normal station.
 *
 * `size` is the pixel size the SVG declares; the drawing is the same at any
 * size, so callers can render it at 2x for a high-DPI style image.
 */
export const stationMarkerSvg = (unassigned = false, size = STATION_MARKER_SIZE): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <circle cx="16" cy="17" r="14" fill="rgba(0,0,0,0.25)"></circle>
  <circle cx="16" cy="16" r="13" fill="${unassigned ? UNASSIGNED_STATION_COLOR : STATION_COLOR}" stroke="white" stroke-width="2"></circle>
  <g transform="translate(7.6 7.6) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FUEL_ICON_PATHS}</g>
</svg>`.trim();

/** A DOM element for a single station marker (e.g. a maplibregl.Marker). */
export const createStationMarkerElement = (unassigned = false): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'fuelog-station-marker';
  el.style.width = `${STATION_MARKER_SIZE}px`;
  el.style.height = `${STATION_MARKER_SIZE}px`;
  el.innerHTML = stationMarkerSvg(unassigned);
  return el;
};

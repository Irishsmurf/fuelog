import L from 'leaflet';

/**
 * Shared map tile provider configuration.
 * Uses CartoDB Positron for light theme and CartoDB Dark Matter for dark theme
 * to provide a quieter, more minimal visual appearance.
 */
export const MAP_TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

// Lucide's "fuel" icon path data, inlined so map markers don't need a React
// render pass — Leaflet markers are plain DOM, not React elements.
const FUEL_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="3" x2="15" y1="22" y2="22"></line>
  <line x1="4" x2="14" y1="9" y2="9"></line>
  <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path>
  <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path>
</svg>
`;

/**
 * A themed station marker: an amber pin (matching the brand palette) with
 * the same "fuel pump" glyph used for the Stations nav item, in place of
 * Leaflet's generic default pin. `unassigned` renders a muted grey variant
 * for logs with coordinates but no associated Station document, so they
 * remain visually distinct on the map rather than looking like a normal
 * station.
 */
export const createStationIcon = (unassigned = false): L.DivIcon => L.divIcon({
  className: 'fuelog-station-marker',
  html: `
    <div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: ${unassigned ? '#9ca3af' : '#f59e0b'};
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    ">${FUEL_ICON_SVG}</div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

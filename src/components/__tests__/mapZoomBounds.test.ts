import { describe, it, expect, afterEach } from 'vitest';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MAP_MAX_ZOOM } from '../../utils/mapConstants';

/**
 * Regression test for the /map crash introduced by the vector basemap migration.
 *
 * Leaflet derives Map.getMaxZoom() from its layers. The raster <TileLayer> used
 * to supply one (Leaflet's default of 18); L.maplibreGL is a plain L.Layer and
 * supplies none, so getMaxZoom() became Infinity. MarkerClusterGroup.onAdd
 * throws a bare string in that case, which React surfaced as an ErrorBoundary
 * with `message: undefined` because a thrown string carries no .message.
 *
 * These run against a real Leaflet map in jsdom — no WebGL involved, so the
 * basemap layer itself is irrelevant and correctly absent here.
 */
const makeContainer = (): HTMLElement => {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
};

let maps: L.Map[] = [];

const makeMap = (options: L.MapOptions): L.Map => {
  const map = L.map(makeContainer(), { center: [53.3, -6.2], zoom: 10, ...options });
  maps.push(map);
  return map;
};

afterEach(() => {
  maps.forEach((m) => m.remove());
  maps = [];
});

describe('map zoom bounds', () => {
  it('exposes a finite maxZoom, which clustering requires', () => {
    const map = makeMap({ maxZoom: MAP_MAX_ZOOM });

    expect(Number.isFinite(map.getMaxZoom())).toBe(true);
    expect(map.getMaxZoom()).toBe(MAP_MAX_ZOOM);
  });

  it('accepts a marker cluster group when maxZoom is set', () => {
    const map = makeMap({ maxZoom: MAP_MAX_ZOOM });
    const cluster = L.markerClusterGroup();
    cluster.addLayer(L.marker([53.3, -6.2]));

    expect(() => cluster.addTo(map)).not.toThrow();
  });

  // Proves the assertion above is load-bearing: without maxZoom, and with no
  // tile layer to supply one, this is exactly the production failure.
  it('would throw without a maxZoom, which is what this guards against', () => {
    const map = makeMap({});
    const cluster = L.markerClusterGroup();
    cluster.addLayer(L.marker([53.3, -6.2]));

    expect(map.getMaxZoom()).toBe(Infinity);
    expect(() => cluster.addTo(map)).toThrow();
  });
});

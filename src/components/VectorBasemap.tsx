import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_ATTRIBUTION, MAP_STYLES, cartoTransformRequest } from '../utils/mapConstants';

// maplibre-gl derives its worker URL at runtime by string-manipulating
// import.meta.url into a sibling "maplibre-gl-worker.mjs". No bundler can see
// that statically, so the file is never emitted and the request 404s — which
// this app's SPA rewrite answers with index.html, failing the module's MIME
// check. Point maplibre at a worker Vite actually bundles instead.
setWorkerUrl(maplibreWorkerUrl);

interface VectorBasemapProps {
  theme: 'light' | 'dark';
}

/**
 * CARTO's vector basemap rendered as a layer inside the existing Leaflet map,
 * in place of a raster <TileLayer>.
 *
 * Going through maplibre-gl-leaflet rather than migrating to a MapLibre-native
 * React wrapper keeps the rest of the map stack intact: leaflet.heat,
 * leaflet.markercluster, the L.divIcon station markers and the useMap hooks all
 * continue to work unchanged.
 */
const VectorBasemap: React.FC<VectorBasemapProps> = ({ theme }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const layer = L.maplibreGL({
      style: theme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light,
      transformRequest: cartoTransformRequest,
      // Leaflet already renders an attribution control; MapLibre's own would
      // duplicate it inside the canvas.
      attributionControl: false,
    }).addTo(map);

    map.attributionControl?.addAttribution(MAP_ATTRIBUTION);

    return () => {
      map.removeLayer(layer);
      map.attributionControl?.removeAttribution(MAP_ATTRIBUTION);
    };
  }, [map, theme]);

  return null;
};

export default VectorBasemap;

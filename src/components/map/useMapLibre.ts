import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from './maplibre';
import { useTheme } from '../../context/ThemeContext';
import { MAP_ATTRIBUTION, MAP_MAX_ZOOM, MAP_STYLES, cartoTransformRequest } from '../../utils/mapConstants';

export interface MapLibreOptions {
  /** Initial centre as [longitude, latitude]. Read once, when the map is created. */
  center: [number, number];
  /** Initial zoom. Read once, when the map is created. */
  zoom: number;
  /** false renders a static map: no pan, zoom or rotate handlers at all. */
  interactive?: boolean;
  scrollZoom?: boolean;
}

export interface MapLibreHandle {
  /** Attach to the element the map should fill. */
  containerRef: (el: HTMLDivElement | null) => void | (() => void);
  /** The map, once the container is mounted; null before and after. */
  map: MapLibreMap | null;
  /**
   * Increments every time a basemap style finishes loading, and is 0 until the
   * first one has. A style swap (the light/dark theme toggle) replaces the whole
   * style, discarding any sources, layers and images added on top of it, so
   * effects that add those depend on this to re-add them.
   */
  styleGeneration: number;
}

/**
 * Owns one `maplibregl.Map`: created when the container mounts, removed when
 * it unmounts, with the CARTO vector basemap following the app's light/dark
 * theme.
 *
 * The initial view is taken from the first render's options, so render the
 * component that calls this only once the data that decides the view is
 * available.
 */
export function useMapLibre(options: MapLibreOptions): MapLibreHandle {
  const { theme } = useTheme();
  const styleUrl = theme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light;

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleGeneration, setStyleGeneration] = useState(0);

  // Initial-only settings, read when the container mounts.
  const initialRef = useRef({ ...options, styleUrl });
  // The style the live map was last given, so the theme effect below can tell
  // a real change from the first run.
  const appliedStyleRef = useRef(styleUrl);

  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const { center, zoom, interactive = true, scrollZoom = true, styleUrl: initialStyle } = initialRef.current;

    const instance = new maplibregl.Map({
      container,
      style: initialStyle,
      center,
      zoom,
      maxZoom: MAP_MAX_ZOOM,
      interactive,
      scrollZoom,
      transformRequest: cartoTransformRequest,
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
    });
    appliedStyleRef.current = initialStyle;

    const onStyleLoad = () => setStyleGeneration((g) => g + 1);
    instance.on('style.load', onStyleLoad);
    setMap(instance);

    return () => {
      instance.off('style.load', onStyleLoad);
      instance.remove();
      setMap(null);
      setStyleGeneration(0);
    };
  }, []);

  useEffect(() => {
    if (!map || appliedStyleRef.current === styleUrl) return;
    appliedStyleRef.current = styleUrl;
    // diff: false forces a full reload, so 'style.load' fires and callers
    // re-add their layers. A diffed update would silently drop them instead.
    map.setStyle(styleUrl, { diff: false });
  }, [map, styleUrl]);

  return { containerRef, map, styleGeneration };
}

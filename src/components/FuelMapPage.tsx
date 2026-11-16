// src/components/FuelMapPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { localizeStation } from '@fuelog/core';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap, Marker as MapLibreMarker, Popup as MapLibrePopup } from 'maplibre-gl';
import { useHomeCurrency } from '../hooks/useHomeCurrency';
import { MapPin, Navigation, AlertCircle, Loader, Layers, Activity } from 'lucide-react'; // Icons
import maplibregl from './map/maplibre';
import { useMapLibre } from './map/useMapLibre';
import { STATION_IMAGE, UNASSIGNED_STATION_IMAGE, addStationImages, findStyleFont } from './map/styleHelpers';

import { fetchFuelLocations, fetchUserStations } from '../firebase/firestoreService'; // Adjust path if needed
import { Log, Station } from '../utils/types';
import { formatDate } from '../utils/formatDate';
import { STATION_COLOR } from '../utils/mapConstants';
import { useTranslation } from 'react-i18next';

type ViewMode = 'cluster' | 'heatmap';

interface StationGroup {
  logs: Log[];
  station?: Station;
}

const DUBLIN: [number, number] = [-6.2603, 53.3498];

const STATIONS_SOURCE = 'fuelog-stations';
const HEAT_SOURCE = 'fuelog-heat';
const CLUSTER_LAYER = 'fuelog-clusters';
const CLUSTER_COUNT_LAYER = 'fuelog-cluster-count';
const POINT_LAYER = 'fuelog-station-points';
const HEATMAP_LAYER = 'fuelog-heatmap';
const STATION_LAYERS = [CLUSTER_LAYER, CLUSTER_COUNT_LAYER, POINT_LAYER];

const groupPosition = (group: StationGroup): [number, number] => group.station
  ? [group.station.longitude, group.station.latitude]
  : [group.logs[0].longitude!, group.logs[0].latitude!];

const StationPopup: React.FC<{ group: StationGroup; currencySymbol: string }> = ({ group, currencySymbol }) => {
  const { t } = useTranslation();
  const firstLog = group.logs[0];
  return (
    <div className="p-1 min-w-[180px]">
      <div className="flex flex-col mb-3 pb-2 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex items-start">
              <MapPin className="w-5 h-5 mr-1.5 text-brand-primary dark:text-brand-primary-glow flex-shrink-0 mt-0.5" />
              <span className="font-display font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
                  {group.station?.name || firstLog.brand || 'N/A'}
              </span>
          </div>
          {!group.station && (
              <div className="mt-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  {t('common.unassignedLocation')}
              </div>
          )}
          {group.station?.avgPrice && (
              <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded bg-green-50 dark:bg-green-500/10 text-[11px] text-brand-success font-bold uppercase border border-green-200 dark:border-green-500/20 w-fit">
                  <span className="fuel-numeral">
                      {t('map.avgPrice', 'Avg: {{currency}}{{price}}/L', { currency: currencySymbol, price: group.station.avgPrice.toFixed(3) })}
                  </span>
              </div>
          )}
      </div>
      <div className="space-y-2.5">
          {group.logs.slice(0, 3).map(log => (
              <div key={log.id} className="text-xs border-b border-gray-100 dark:border-gray-800/60 pb-2 last:border-0 last:pb-0">
                  <p className="flex justify-between items-center font-medium mb-0.5">
                      <span className="text-gray-600 dark:text-gray-300">{formatDate(log.timestamp.toDate())}</span>
                      <span className="text-brand-success font-bold fuel-numeral">€{log.cost.toFixed(2)}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                      <span className="fuel-numeral">{log.fuelAmountLiters.toFixed(2)}L</span>
                      <span className="fuel-numeral">
                          {log.fuelAmountLiters > 0
                              ? (log.cost / log.fuelAmountLiters).toFixed(3)
                              : (0).toFixed(3)}/L
                      </span>
                  </p>
              </div>
          ))}
      </div>
      {group.logs.length > 3 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-[10px] text-brand-primary dark:text-brand-primary-glow font-bold text-center uppercase tracking-wider">
              {t('map.olderFuelings', { count: group.logs.length - 3 })}
          </div>
      )}
      {group.logs.length <= 3 && group.logs.length > 1 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-[10px] text-gray-400 text-center font-bold uppercase tracking-wider">
              {t('map.fuelingsAtStation', { count: group.logs.length })}
          </div>
      )}
    </div>
  );
};

/** Adds the station and heatmap sources and layers, if the current style lacks them. */
const ensureLayers = (map: MapLibreMap) => {
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  if (!map.getSource(HEAT_SOURCE)) {
    map.addSource(HEAT_SOURCE, { type: 'geojson', data: empty });
  }
  if (!map.getLayer(HEATMAP_LAYER)) {
    map.addLayer({
      id: HEATMAP_LAYER,
      type: 'heatmap',
      source: HEAT_SOURCE,
      paint: {
        'heatmap-radius': 25,
        // Ramp intensity up with zoom, reaching full strength at city level
        // (the old leaflet.heat layer's maxZoom of 10).
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 3],
        'heatmap-opacity': 0.8,
      },
    });
  }

  if (!map.getSource(STATIONS_SOURCE)) {
    map.addSource(STATIONS_SOURCE, {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
  }
  if (!map.getLayer(CLUSTER_LAYER)) {
    map.addLayer({
      id: CLUSTER_LAYER,
      type: 'circle',
      source: STATIONS_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': STATION_COLOR,
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24],
      },
    });
  }
  const font = findStyleFont(map);
  if (font && !map.getLayer(CLUSTER_COUNT_LAYER)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: 'symbol',
      source: STATIONS_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': font,
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    });
  }
};

/** The station icons are decoded asynchronously, so their layer follows once they exist. */
const ensurePointLayer = (map: MapLibreMap, visible: boolean) => {
  if (map.getLayer(POINT_LAYER) || !map.getSource(STATIONS_SOURCE)) return;
  map.addLayer({
    id: POINT_LAYER,
    type: 'symbol',
    source: STATIONS_SOURCE,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['case', ['get', 'unassigned'], UNASSIGNED_STATION_IMAGE, STATION_IMAGE],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      visibility: visible ? 'visible' : 'none',
    },
  });
};

interface FuelMapProps {
  groups: Record<string, StationGroup>;
  points: Log[];
  viewMode: ViewMode;
  currencySymbol: string;
}

/**
 * The map itself. Mounted only once the logs have loaded, so the initial view
 * can be taken from them.
 */
const FuelMap: React.FC<FuelMapProps> = ({ groups, points, viewMode, currencySymbol }) => {
  const { containerRef, map, styleGeneration } = useMapLibre({
    center: points.length > 0 ? [points[0].longitude!, points[0].latitude!] : DUBLIN,
    zoom: points.length > 0 ? 10 : 6,
  });
  const [popup, setPopup] = useState<{ key: string; container: HTMLDivElement } | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const [locating, setLocating] = useState(false);
  const youAreHereRef = useRef<MapLibreMarker | null>(null);
  // Read by map event handlers and async callbacks, which outlive a render.
  const groupsRef = useRef(groups);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    groupsRef.current = groups;
    viewModeRef.current = viewMode;
  }, [groups, viewMode]);

  const stationData = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: Object.entries(groups).map(([key, group]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: groupPosition(group) },
      properties: { key, unassigned: !group.station },
    })),
  }), [groups]);

  const heatData = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: points.map(log => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [log.longitude!, log.latitude!] },
      properties: {},
    })),
  }), [points]);

  // Zoom control, bottom-left: the full-bleed map tucks its top edge under
  // the sticky header, so top-left controls would not be tappable.
  useEffect(() => {
    if (!map) return;
    const control = new maplibregl.NavigationControl({ showCompass: false });
    map.addControl(control, 'bottom-left');
    return () => {
      // map.remove() (the map unmounting first) already detached it.
      if (map.hasControl(control)) map.removeControl(control);
    };
  }, [map]);

  // Frame all the logs once, unless they are already in view.
  useEffect(() => {
    if (!map || points.length === 0) return;
    const coords = points.map(p => [p.longitude!, p.latitude!] as [number, number]);
    const visible = map.getBounds();
    if (coords.every(c => visible.contains(c))) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 40, maxZoom: 14, animate: false });
  }, [map, points]);

  // Sources and layers. Re-run after every style load: a theme swap replaces
  // the style and everything added on top of it.
  useEffect(() => {
    if (!map || styleGeneration === 0) return;
    ensureLayers(map);
    let cancelled = false;
    addStationImages(map)
      .then(() => {
        if (!cancelled) ensurePointLayer(map, viewModeRef.current === 'cluster');
      })
      .catch(err => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [map, styleGeneration]);

  useEffect(() => {
    if (!map || styleGeneration === 0) return;
    (map.getSource(STATIONS_SOURCE) as GeoJSONSource | undefined)?.setData(stationData);
    (map.getSource(HEAT_SOURCE) as GeoJSONSource | undefined)?.setData(heatData);
  }, [map, styleGeneration, stationData, heatData]);

  useEffect(() => {
    if (!map || styleGeneration === 0) return;
    const stationVisibility = viewMode === 'cluster' ? 'visible' : 'none';
    for (const id of STATION_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', stationVisibility);
    }
    if (map.getLayer(HEATMAP_LAYER)) {
      map.setLayoutProperty(HEATMAP_LAYER, 'visibility', viewMode === 'heatmap' ? 'visible' : 'none');
    }
    if (viewMode === 'heatmap') popupRef.current?.remove();
  }, [map, styleGeneration, viewMode]);

  // Clicks: a cluster zooms in to split apart, a station opens its popup.
  useEffect(() => {
    if (!map) return;

    const onClusterClick = async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const source = map.getSource(STATIONS_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
    };

    const onPointClick = (e: MapLayerMouseEvent) => {
      const key = e.features?.[0]?.properties?.key as string | undefined;
      const group = key ? groupsRef.current[key] : undefined;
      if (!key || !group) return;

      popupRef.current?.remove();
      const container = document.createElement('div');
      const instance = new maplibregl.Popup({ offset: 14, maxWidth: '300px' })
        .setLngLat(groupPosition(group))
        .setDOMContent(container)
        .addTo(map);
      instance.on('close', () => {
        if (popupRef.current === instance) popupRef.current = null;
        setPopup(current => (current?.container === container ? null : current));
      });
      popupRef.current = instance;
      setPopup({ key, container });
    };

    const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const clearPointer = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', CLUSTER_LAYER, onClusterClick);
    map.on('click', POINT_LAYER, onPointClick);
    for (const id of [CLUSTER_LAYER, POINT_LAYER]) {
      map.on('mouseenter', id, setPointer);
      map.on('mouseleave', id, clearPointer);
    }
    return () => {
      map.off('click', CLUSTER_LAYER, onClusterClick);
      map.off('click', POINT_LAYER, onPointClick);
      for (const id of [CLUSTER_LAYER, POINT_LAYER]) {
        map.off('mouseenter', id, setPointer);
        map.off('mouseleave', id, clearPointer);
      }
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [map]);

  useEffect(() => () => {
    youAreHereRef.current?.remove();
  }, []);

  const handleLocate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent map click
    if (!map) return;
    if (!navigator.geolocation) {
      alert("Could not locate you: geolocation is unavailable");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const here: [number, number] = [position.coords.longitude, position.coords.latitude];
        youAreHereRef.current?.remove();
        youAreHereRef.current = new maplibregl.Marker()
          .setLngLat(here)
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText("You are here"))
          .addTo(map)
          .togglePopup();
        map.flyTo({ center: here, zoom: 14 });
      },
      (err) => {
        setLocating(false);
        alert("Could not locate you: " + err.message);
      },
    );
  };

  const popupGroup = popup ? groups[popup.key] : undefined;

  return (
    <>
      {/* MapLibre's stylesheet makes the map element position: relative, so
          the absolute positioning lives on a wrapper rather than on it. */}
      <div className="absolute inset-0">
        <div ref={containerRef} data-testid="fuel-map" className="h-full w-full" />
      </div>
      <button
        type="button"
        className="absolute bottom-10 right-2.5 z-10 flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer w-8 h-8 sm:w-10 sm:h-10 shadow-md rounded-sm border-2 border-gray-300 dark:border-gray-600"
        title="Locate Me"
        aria-label="Locate Me"
        onClick={handleLocate}
      >
        {locating ? <Loader className="w-5 h-5 animate-spin text-gray-600 dark:text-gray-300" /> : <Navigation className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
      </button>
      {popup && popupGroup && createPortal(
        <StationPopup group={popupGroup} currencySymbol={currencySymbol} />,
        popup.container,
      )}
    </>
  );
};


const FuelMapPage: React.FC = () => {
  const { t } = useTranslation();
  const { code: homeCurrency, symbol: currencySymbol } = useHomeCurrency();
  const [locations, setLocations] = useState<Log[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cluster');

  useEffect(() => {
       const loadData = async () => {
           setLoading(true);
           setError(null);
           try {
               const logs = await fetchFuelLocations();
               setLocations(logs);

               const stationData = await fetchUserStations(logs);
               setStations(stationData);
           } catch (err) {
               setError("Failed to load map data.");
               console.error(err);
           } finally {
               setLoading(false);
           }
       };
       loadData();
  }, []);

  const validLocations = useMemo(() => {
      return locations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);
  }, [locations]);

  // Group logs by stationId — the canonical grouping key, since a station's
  // stored coordinates and a log's raw GPS reading are independent values
  // that don't reliably round to the same key. Logs with no stationId
  // (pre-station-association logs, or low-GPS-accuracy logs that skipped
  // association) fall back to coordinate-rounding so they still appear on
  // the map, grouped separately and flagged as unassigned.
  const stationGroups = useMemo(() => {
     const stationsById = new Map(stations.map(s => [s.id, localizeStation(s, homeCurrency)]));

     const groups: Record<string, StationGroup> = {};
     validLocations.forEach(log => {
         const key = log.stationId
             ? `station-${log.stationId}`
             : `coord-${log.latitude!.toFixed(4)}_${log.longitude!.toFixed(4)}`;
         if (!groups[key]) {
             groups[key] = { logs: [], station: log.stationId ? stationsById.get(log.stationId) : undefined };
         }
         groups[key].logs.push(log);
     });
     return groups;
  }, [validLocations, stations, homeCurrency]);

  if (loading) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 flex justify-center items-center bg-gray-50 dark:bg-brand-dark-surface">
        <Loader className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 flex flex-col justify-center items-center bg-gray-50 dark:bg-brand-dark-surface text-red-500 dark:text-red-400">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 overflow-hidden">
       <FuelMap groups={stationGroups} points={validLocations} viewMode={viewMode} currencySymbol={currencySymbol} />

       {validLocations.length === 0 && (
           <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-gray-200 dark:border-gray-700 flex items-center">
               <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
               <span className="text-sm text-gray-700 dark:text-gray-300">No fuel logs with location data found.</span>
           </div>
       )}

       <div className="absolute top-20 right-4 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg shadow-md border border-gray-200 dark:border-gray-700/60 flex overflow-hidden">
         <button
           onClick={() => setViewMode('cluster')}
           className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewMode === 'cluster' ? 'text-brand-primary-hover dark:text-brand-primary shadow-[inset_0_0_0_1px_var(--color-brand-primary)]' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
         >
           <Layers className="w-4 h-4 mr-1.5" />
           {t('map.clusters', 'Clusters')}
         </button>
         <button
           onClick={() => setViewMode('heatmap')}
           className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewMode === 'heatmap' ? 'text-brand-primary-hover dark:text-brand-primary shadow-[inset_0_0_0_1px_var(--color-brand-primary)]' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
         >
           <Activity className="w-4 h-4 mr-1.5" />
           {t('map.heatmap', 'Heatmap')}
         </button>
       </div>
    </div>
  );
};

export default FuelMapPage;

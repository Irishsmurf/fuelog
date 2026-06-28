// src/components/FuelMapPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster'; // Import the cluster group
import { MapPin, Navigation, AlertCircle, Loader, Layers, Activity } from 'lucide-react'; // Icons
import HeatmapLayer from './HeatmapLayer';

// CSS Imports
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';        // Cluster CSS
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'; // Cluster Default Theme CSS

import { fetchFuelLocations, fetchUserStations } from '../firebase/firestoreService'; // Adjust path if needed
import { Log, Station } from '../utils/types';
import { formatDate } from '../utils/formatDate';
import { useTheme } from '../context/ThemeContext';
import { MAP_TILES, createStationIcon } from '../utils/mapConstants';
import { useTranslation } from 'react-i18next';

// --- Icon Fix (points to public assets) ---
const iconRetinaUrl = '/marker-icon-2x.png';
const iconUrl = '/marker-icon.png';
const shadowUrl = '/marker-shadow.png';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
// --- End Icon Fix ---

// FitBounds component remains the same
const FitBoundsToMarkers = ({ points }: { points: Log[] }) => {
   const map = useMap();
   useEffect(() => {
       if (!map || points.length === 0) return;
       const validPoints = points.filter(p => p.latitude !== undefined && p.longitude !== undefined);
       if (validPoints.length > 0) {
           const bounds = L.latLngBounds(validPoints.map(p => [p.latitude!, p.longitude!]));
           if (map.getZoom() === undefined || !map.getBounds().contains(bounds)) {
              map.fitBounds(bounds.pad(0.1));
           }
       }
   }, [map, points]);
   return null;
};

// Custom Locate Control
const LocateControl = () => {
    const map = useMap();
    const [locating, setLocating] = useState(false);

    const handleLocate = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent map click
        setLocating(true);
        map.locate({ setView: true, maxZoom: 14 })
           .on("locationfound", function (e) {
               setLocating(false);
               L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
               map.flyTo(e.latlng, 14);
           })
           .on("locationerror", function (e) {
               setLocating(false);
               alert("Could not locate you: " + e.message);
           });
    };

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar">
                 <a
                    className="leaflet-control-custom-btn flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer w-8 h-8 sm:w-10 sm:h-10 shadow-md rounded-sm border-2 border-gray-300 dark:border-gray-600"
                    role="button"
                    title="Locate Me"
                    onClick={handleLocate}
                 >
                    {locating ? <Loader className="w-5 h-5 animate-spin text-gray-600 dark:text-gray-300" /> : <Navigation className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
                 </a>
            </div>
        </div>
    );
};


const FuelMapPage: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [locations, setLocations] = useState<Log[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cluster' | 'heatmap'>('cluster');

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

  const heatmapPoints = useMemo(() => {
      return validLocations.map(log => [log.latitude!, log.longitude!, 1] as [number, number, number]);
  }, [validLocations]);

  const heatmapOptions = useMemo<L.HeatMapOptions>(() => ({
      radius: 25, blur: 15, maxZoom: 10
  }), []);

  // Group logs by stationId — the canonical grouping key, since a station's
  // stored coordinates and a log's raw GPS reading are independent values
  // that don't reliably round to the same key. Logs with no stationId
  // (pre-station-association logs, or low-GPS-accuracy logs that skipped
  // association) fall back to coordinate-rounding so they still appear on
  // the map, grouped separately and flagged as unassigned.
  const stationGroups = useMemo(() => {
     const stationsById = new Map(stations.map(s => [s.id, s]));

     const groups: { [key: string]: { logs: Log[], station?: Station } } = {};
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
  }, [validLocations, stations]);

  if (loading) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 flex justify-center items-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 text-red-500 dark:text-red-400">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  const initialCenter: L.LatLngExpression = validLocations.length > 0
      ? [validLocations[0].latitude!, validLocations[0].longitude!]
      : [53.3498, -6.2603]; // Default to Dublin

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-0 overflow-hidden">
       {validLocations.length === 0 && (
           <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-gray-200 dark:border-gray-700 flex items-center">
               <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
               <span className="text-sm text-gray-700 dark:text-gray-300">No fuel logs with location data found.</span>
           </div>
       )}

       <div className="absolute top-20 right-4 z-[1000] bg-white dark:bg-gray-800 rounded-md shadow-md border border-gray-200 dark:border-gray-700 flex overflow-hidden">
         <button 
           onClick={() => setViewMode('cluster')}
           className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewMode === 'cluster' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
         >
           <Layers className="w-4 h-4 mr-1.5" />
           {t('map.clusters', 'Clusters')}
         </button>
         <button 
           onClick={() => setViewMode('heatmap')}
           className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewMode === 'heatmap' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
         >
           <Activity className="w-4 h-4 mr-1.5" />
           {t('map.heatmap', 'Heatmap')}
         </button>
       </div>

      <MapContainer center={initialCenter} zoom={validLocations.length > 0 ? 10 : 6} scrollWheelZoom={true} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        {/* Default zoom control lives top-left, where the full-bleed map now
            tucks under the sticky header. Move it bottom-left so it stays
            tappable. */}
        <ZoomControl position="bottomleft" />
        <TileLayer
          attribution={MAP_TILES.attribution}
          url={theme === 'dark' ? MAP_TILES.dark : MAP_TILES.light}
        />

        {viewMode === 'cluster' ? (
          <MarkerClusterGroup chunkedLoading>
            {Object.entries(stationGroups).map(([key, group]) => {
              const firstLog = group.logs[0];
              const pos: L.LatLngExpression = group.station 
                ? [group.station.latitude, group.station.longitude]
                : [firstLog.latitude!, firstLog.longitude!];
                
              return (
                <Marker key={key} position={pos} icon={createStationIcon(!group.station)}>
                  <Popup>
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
                                      {t('map.avgPrice', 'Avg: €{{price}}/L', { price: group.station.avgPrice.toFixed(3) })}
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
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        ) : (
          <HeatmapLayer points={heatmapPoints} options={heatmapOptions} />
        )}

        <FitBoundsToMarkers points={validLocations} />
        <LocateControl />

      </MapContainer>
    </div>
  );
};

export default FuelMapPage;

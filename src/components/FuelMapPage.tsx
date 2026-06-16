// src/components/FuelMapPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster'; // Import the cluster group
import { MapPin, Navigation, AlertCircle, Loader } from 'lucide-react'; // Icons

// CSS Imports
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';        // Cluster CSS
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'; // Cluster Default Theme CSS

import { fetchFuelLocations, fetchUserStations } from '../firebase/firestoreService'; // Adjust path if needed
import { Log, Station } from '../utils/types';
import { formatDate } from '../utils/formatDate';
import { useTheme } from '../context/ThemeContext';
import { MAP_TILES } from '../utils/mapConstants';

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
  const [locations, setLocations] = useState<Log[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Group logs by latitude & longitude
  const stationGroups = useMemo(() => {
     const stationsByCoord = new Map<string, Station>();
     stations.forEach(s => {
         stationsByCoord.set(`${s.latitude.toFixed(4)}_${s.longitude.toFixed(4)}`, s);
     });

     const groups: { [key: string]: { logs: Log[], station?: Station } } = {};
     validLocations.forEach(log => {
         const key = `${log.latitude!.toFixed(4)}_${log.longitude!.toFixed(4)}`;
         if (!groups[key]) {
             groups[key] = { logs: [], station: stationsByCoord.get(key) };
         }
         groups[key].logs.push(log);
     });
     return groups;
  }, [validLocations, stations]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh] min-h-[400px]">
        <Loader className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] min-h-[400px] text-red-500 dark:text-red-400">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  const initialCenter: L.LatLngExpression = validLocations.length > 0
      ? [validLocations[0].latitude!, validLocations[0].longitude!]
      : [53.3498, -6.2603]; // Default to Dublin

  return (
    <div className="w-full h-[60vh] min-h-[400px] rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 relative">
       {validLocations.length === 0 && (
           <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-gray-200 dark:border-gray-700 flex items-center">
               <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
               <span className="text-sm text-gray-700 dark:text-gray-300">No fuel logs with location data found.</span>
           </div>
       )}

      <MapContainer center={initialCenter} zoom={validLocations.length > 0 ? 10 : 6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution={MAP_TILES.attribution}
          url={theme === 'dark' ? MAP_TILES.dark : MAP_TILES.light}
        />

        <MarkerClusterGroup chunkedLoading>
          {Object.entries(stationGroups).map(([key, group]) => {
            const firstLog = group.logs[0];
            const pos: L.LatLngExpression = group.station 
              ? [group.station.latitude, group.station.longitude]
              : [firstLog.latitude!, firstLog.longitude!];
              
            return (
              <Marker key={key} position={pos}>
                <Popup>
                  <div className="p-1 min-w-[180px]">
                    <div className="flex flex-col mb-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                {group.station?.name || firstLog.brand || 'N/A'}
                            </span>
                        </div>
                        {group.station?.avgPrice && (
                            <div className="mt-1 flex items-center text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">
                                <span>Avg Price: €{group.station.avgPrice.toFixed(3)}/L</span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {group.logs.map(log => (
                            <div key={log.id} className="text-xs border-b border-gray-50 dark:border-gray-800 pb-1 last:border-0">
                                <p className="flex justify-between font-medium">
                                    <span>{formatDate(log.timestamp.toDate())}</span>
                                    <span className="text-green-600 dark:text-green-400">€{log.cost.toFixed(2)}</span>
                                </p>
                                <p className="text-[10px] text-gray-500">
                                    {log.fuelAmountLiters.toFixed(2)}L @ {(log.cost / log.fuelAmountLiters).toFixed(3)}/L
                                </p>
                            </div>
                        ))}
                    </div>
                    {group.logs.length > 1 && (
                        <div className="mt-2 pt-1 border-t border-gray-200 dark:border-gray-700 text-[9px] text-gray-400 text-center font-bold uppercase tracking-wider">
                            {group.logs.length} Fuelings at this station
                        </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        <FitBoundsToMarkers points={validLocations} />
        <LocateControl />

      </MapContainer>
    </div>
  );
};

export default FuelMapPage;

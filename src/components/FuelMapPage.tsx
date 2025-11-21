// src/components/FuelMapPage.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster'; // Import the cluster group
import { MapPin, Navigation, AlertCircle, Loader } from 'lucide-react'; // Icons

// CSS Imports
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';        // Cluster CSS
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'; // Cluster Default Theme CSS

import { fetchFuelLocations } from '../firebase/firestoreService'; // Adjust path if needed
import { Log } from '../utils/types';

// --- Icon Fix (keep this as before) ---
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
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
  const [locations, setLocations] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
       const loadData = async () => {
           setLoading(true);
           setError(null);
           try {
               const data = await fetchFuelLocations();
               setLocations(data);
           } catch (err) {
               setError("Failed to load locations.");
               console.error(err);
           } finally {
               setLoading(false);
           }
       };
       loadData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
       <Loader className="w-8 h-8 animate-spin mb-2" />
       <p>Loading map data...</p>
    </div>
  );

  if (error) return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 m-4">
          <AlertCircle className="w-8 h-8 mb-2" />
          <p>{error}</p>
      </div>
  );

  const validLocations = locations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);

  // If no valid locations, we can default to user location or a default.
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MarkerClusterGroup chunkedLoading>
          {validLocations.map((log) => (
            <Marker key={log.id} position={[log.latitude!, log.longitude!]}>
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <div className="flex items-center mb-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                      <MapPin className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{log.brand || 'N/A'}</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      <p className="flex justify-between"><span>Date:</span> <span className="font-medium">{log.timestamp.toDate().toLocaleDateString()}</span></p>
                      <p className="flex justify-between"><span>Cost:</span> <span className="font-medium text-green-600 dark:text-green-400">€{log.cost.toFixed(2)}</span></p>
                      <p className="flex justify-between"><span>Litres:</span> <span className="font-medium">{log.fuelAmountLiters.toFixed(2)} L</span></p>
                      <p className="flex justify-between"><span>Distance:</span> <span className="font-medium">{log.distanceKm.toFixed(1)} km</span></p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <FitBoundsToMarkers points={validLocations} />
        <LocateControl />

      </MapContainer>
    </div>
  );
};

export default FuelMapPage;
// src/components/FuelMapPage.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster'; // Import the cluster group

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

// FitBounds component remains the same, but now might fit to the cluster group extent initially
const FitBoundsToMarkers = ({ points }: { points: Log[] }) => {
   const map = useMap();
   useEffect(() => {
       if (!map || points.length === 0) return;
       const validPoints = points.filter(p => p.latitude !== undefined && p.longitude !== undefined);
       if (validPoints.length > 0) {
           const bounds = L.latLngBounds(validPoints.map(p => [p.latitude!, p.longitude!]));
           // Check if map already has bounds set (important with clustering)
           if (map.getZoom() === undefined || !map.getBounds().contains(bounds)) {
              map.fitBounds(bounds.pad(0.1));
           }
       }
   }, [map, points]); // Dependency on points ensures it runs when data arrives
   return null;
};


const FuelMapPage: React.FC = () => {
  const [locations, setLocations] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
   // ... (your existing data fetching logic) ...
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

  if (loading) return <div>Loading map data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const validLocations = locations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);

  if (validLocations.length === 0) return <div>No fuel locations with coordinates found.</div>;

  const initialCenter: L.LatLngExpression = validLocations.length > 0
      ? [validLocations[0].latitude!, validLocations[0].longitude!]
      : [53.3498, -6.2603]; // Fallback

  return (
    <div className="w-full h-[600px] my-4">
      {/* Center/Zoom on MapContainer might be less critical if FitBoundsToMarkers is used */}
      <MapContainer center={initialCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Wrap Markers with MarkerClusterGroup */}
        <MarkerClusterGroup
           // Optional: Customize cluster appearance/behavior here
           // See react-leaflet-markercluster docs for options
           chunkedLoading // Helps performance with many markers
        >
          {validLocations.map((log) => (
            <Marker key={log.id} position={[log.latitude!, log.longitude!]}>
              <Popup>
                <div>
                  <p><strong>Date:</strong> {log.timestamp.toDate().toLocaleDateString()}</p>
                  <p><strong>Brand:</strong> {log.brand || 'N/A'}</p>
                  <p><strong>Cost:</strong> €{log.cost.toFixed(2)}</p>
                  <p><strong>Litres:</strong> {log.fuelAmountLiters.toFixed(2)} L</p>
                  <p><strong>Distance:</strong> {log.distanceKm.toFixed(1)} km</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* FitBounds can still be used, it will adapt to the marker locations */}
        <FitBoundsToMarkers points={validLocations} />

      </MapContainer>
    </div>
  );
};

export default FuelMapPage;
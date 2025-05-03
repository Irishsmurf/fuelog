// src/components/FuelMapPage.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'; // Added Marker, Popup
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Removed 'leaflet.heat' import

import { fetchFuelLocations } from '../firebase/firestoreService'; // Adjust path if needed
import { Log } from '../utils/types';

// --- Fix for Default Leaflet Icon ---
// (This prevents the default icon from appearing broken)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl; // Delete the broken default method

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});
// --- End Icon Fix ---


// Optional: Component to adjust map view based on markers
const FitBoundsToMarkers = ({ points }: { points: Log[] }) => {
   const map = useMap();
   useEffect(() => {
     if (!map || points.length === 0) return;

     const validPoints = points.filter(p => p.latitude !== undefined && p.longitude !== undefined);
     if (validPoints.length > 0) {
       const bounds = L.latLngBounds(validPoints.map(p => [p.latitude!, p.longitude!]));
       map.fitBounds(bounds.pad(0.1)); // Add some padding
     }
   }, [map, points]);
   return null;
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
           // Optional: Sort data if needed, e.g., by date
           // data.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
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
  if (locations.length === 0) return <div>No fuel locations with coordinates found.</div>;

  // Calculate initial center (can still be based on first point or a default)
  const validLocations = locations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);
  const initialCenter: L.LatLngExpression = validLocations.length > 0
      ? [validLocations[0].latitude!, validLocations[0].longitude!]
      : [53.3498, -6.2603]; // Fallback Dublin center

  return (
    <div className="w-full h-[600px] my-4">
      <MapContainer center={initialCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map over locations and create a Marker for each */}
        {validLocations.map((log) => (
          <Marker key={log.id} position={[log.latitude!, log.longitude!]}>
            <Popup>
              <div>
                <p><strong>Date:</strong> {log.timestamp.toDate().toLocaleDateString()}</p>
                <p><strong>Brand:</strong> {log.brand || 'N/A'}</p>
                <p><strong>Cost:</strong> €{log.cost.toFixed(2)}</p>
                <p><strong>Litres:</strong> {log.fuelAmountLiters.toFixed(2)} L</p>
                <p><strong>Distance:</strong> {log.distanceKm.toFixed(1)} km</p>
                {/* Add more details if desired */}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Add the component to fit bounds */}
        <FitBoundsToMarkers points={validLocations} />

      </MapContainer>
    </div>
  );
};

export default FuelMapPage;
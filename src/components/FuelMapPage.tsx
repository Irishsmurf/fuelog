// src/components/FuelMapPage.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet'; // Import L directly now that types are installed
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; // Make sure this is correctly installed and imported

import { fetchFuelLocations } from '../firebase/firestoreService'; // Adjusted path
import { Log } from '../utils/types';

// Heatmap Layer Component (using L directly with types)
const HeatmapLayer = ({ points }: { points: Log[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    const heatPoints = points
    .filter(p => p.latitude !== undefined && p.longitude !== undefined)
    .map(p => [p.latitude!, p.longitude!, 0.5] as [number, number, number]); // Use basic tuple


    const heatLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 18,
      }).addTo(map);
 

    // Fit map bounds
    if (heatPoints.length > 0) {
      const bounds = L.latLngBounds(heatPoints.map(p => [p[0], p[1]]));
      map.fitBounds(bounds.pad(0.1));
    }

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

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
  if (locations.length === 0) return <div>No fuel locations with coordinates found.</div>;

  const initialCenter: L.LatLngExpression = locations.length > 0
      ? [locations[0].latitude!, locations[0].longitude!]
      : [53.3498, -6.2603]; // Fallback, use LatLngExpression type

  return (
    <div className="w-full h-[600px] my-4">
       {/* MapContainer should now accept 'center' */}
       <MapContainer center={initialCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatmapLayer points={locations} />
      </MapContainer>
    </div>
  );
};

export default FuelMapPage;
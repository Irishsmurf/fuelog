// Simplified example using react-leaflet
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// You'll need to install and import leaflet.heat separately
import 'leaflet.heat'; // Assuming you've installed and imported it appropriately

import { fetchFuelLocations } from '../firebase/firestoreService'; // Import your fetch function
import { Log } from '../utils/types'; // Your Log type
// Assuming L is available globally after importing leaflet and leaflet.heat
declare var L: any;

const HeatmapLayer = ({ points }: { points: Log[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    const heatPoints = points
      .filter(p => p.latitude !== undefined && p.longitude !== undefined)
      .map(p => [p.latitude!, p.longitude!, 0.5]); // Lat, Lng, Intensity

    const heatLayer = (L as any).heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 18,
    });

    map.addLayer(heatLayer);

    // Fit map bounds to points
    if (heatPoints.length > 0) {
       const bounds = L.latLngBounds(heatPoints.map(p => [p[0], p[1]]));
       map.fitBounds(bounds.pad(0.1)); // Add some padding
    }


    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null; // Heatmap layer doesn't render directly
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
        console.log("Fetched locations:", data);
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

  // Calculate initial center (e.g., average lat/lng or first point)
  const initialCenter: [number, number] = locations.length > 0
      ? [locations[0].latitude!, locations[0].longitude!]
      : [53.3498, -6.2603]; // Fallback to Dublin center


  return (
    <div className="w-full h-[600px] my-4"> {/* Ensure container has height */}
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
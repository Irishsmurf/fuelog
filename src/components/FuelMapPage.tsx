// src/components/FuelMapPage.tsx
import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { fetchFuelLocations, fetchUserVehicles } from '../firebase/firestoreService'; // Added fetchUserVehicles
import { Log, Vehicle } from '../utils/types'; // Added Vehicle
import { useAuth } from '../context/AuthContext'; // Added useAuth
import { Link } from 'react-router-dom'; // Added Link

// ... Icon Fix ...
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
// --- End Icon Fix ---

// FitBounds component remains the same, but now might fit to the cluster group extent initially
const FitBoundsToMarkers = ({ points }: { points: Log[] }) => {
   // ... (no change to this component itself, but it will receive filtered points)
   const map = useMap();
   useEffect(() => {
       if (!map || points.length === 0) return;
       const validPoints = points.filter(p => p.latitude !== undefined && p.longitude !== undefined);
       if (validPoints.length > 0) {
           const bounds = L.latLngBounds(validPoints.map(p => [p.latitude!, p.longitude!]));
           if (map.getZoom() === undefined || !map.getBounds().contains(bounds)) {
              map.fitBounds(bounds.pad(0.1));
           }
       } else {
            // If no points after filtering, reset view or zoom out
            map.setView([53.3498, -6.2603], 7); // Fallback center and zoom
       }
   }, [map, points]);
   return null;
};

const FuelMapPage: React.FC = () => {
  const { user } = useAuth(); // Get user for fetching vehicles
  const [allLocations, setAllLocations] = useState<Log[]>([]); // All fetched locations
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [userVehiclesMap, setUserVehiclesMap] = useState<Map<string, string>>(new Map());
  const [userVehiclesForFilter, setUserVehiclesForFilter] = useState<Vehicle[]>([]);
  const [filterVehicleId, setFilterVehicleId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);

  // Fetch all fuel locations
  useEffect(() => {
       const loadData = async () => {
           setLoadingLocations(true);
           setLocationsError(null);
           try {
               const data = await fetchFuelLocations(); // This already filters by user ID if implemented correctly
               setAllLocations(data);
           } catch (err) {
               setLocationsError("Failed to load locations.");
               console.error(err);
           } finally {
               setLoadingLocations(false);
           }
       };
       if (user) { // Only load if user is present
           loadData();
       } else {
           setAllLocations([]);
           setLoadingLocations(false);
       }
  }, [user]);

  // Fetch user vehicles
  useEffect(() => {
    if (!user) {
      setUserVehiclesForFilter([]);
      setUserVehiclesMap(new Map());
      setIsLoadingVehicles(false);
      return;
    }
    setIsLoadingVehicles(true);
    const loadUserVehicles = async () => {
        try {
            const vehicles = await fetchUserVehicles();
            setUserVehiclesForFilter(vehicles);
            const vehicleMap = new Map<string, string>();
            vehicles.forEach(v => vehicleMap.set(v.id, v.name));
            setUserVehiclesMap(vehicleMap);
        } catch (err) {
            console.error("Error fetching user vehicles for map:", err);
            // Optionally set an error state for vehicles
        } finally {
            setIsLoadingVehicles(false);
        }
    };
    loadUserVehicles();
  }, [user]);

  // Memoize filtered locations
  const filteredMapLocations = useMemo(() => {
    let tempLogs = allLocations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);
    if (filterVehicleId) {
      return tempLogs.filter(log => log.vehicleId === filterVehicleId);
    }
    return tempLogs;
  }, [allLocations, filterVehicleId]);


  if (loadingLocations || isLoadingVehicles) return <div className="dark:text-gray-300 p-4 text-center">Loading map data...</div>;
  if (locationsError) return <div className="text-red-500 dark:text-red-400 p-4 text-center">{locationsError}</div>;
  // No need to check for userVehicles error explicitly here, filter will just be empty or disabled

  const initialCenter: L.LatLngExpression = filteredMapLocations.length > 0
      ? [filteredMapLocations[0].latitude!, filteredMapLocations[0].longitude!]
      : [53.3498, -6.2603]; // Fallback

  return (
    <div className="my-4">
      {/* Filter UI */}
      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <label htmlFor="mapVehicleFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Filter by Vehicle:
        </label>
        <select
          id="mapVehicleFilter"
          value={filterVehicleId}
          onChange={(e) => setFilterVehicleId(e.target.value)}
          className="w-full sm:w-auto px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 dark:text-gray-300 appearance-none"
          disabled={isLoadingVehicles || userVehiclesForFilter.length === 0 && !isLoadingVehicles}
        >
          <option value="">All Vehicles</option>
          {userVehiclesForFilter.map(vehicle => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name} ({vehicle.make} {vehicle.model})
            </option>
          ))}
        </select>
        {isLoadingVehicles && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading vehicles...</p>}
        {!isLoadingVehicles && user && userVehiclesForFilter.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No vehicles found. <Link to="/vehicles" className="text-indigo-600 hover:underline">Add one?</Link>
          </p>
        )}
         {!user && !isLoadingVehicles && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Login to filter by vehicle.</p>}
      </div>

      {/* Map Container */}
      {filteredMapLocations.length === 0 && !loadingLocations && (
         <div className="text-center py-10 text-gray-600 dark:text-gray-400">
            {allLocations.length > 0 && filterVehicleId ? 'No locations found for the selected vehicle.' : 'No fuel locations with coordinates found.'}
         </div>
      )}

      {/* Only render map if there are locations to show OR if it's still loading (to avoid map init issues) */}
      {(filteredMapLocations.length > 0 || loadingLocations) && (
          <div className="w-full h-[600px]">
            <MapContainer center={initialCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup chunkedLoading>
                {filteredMapLocations.map((log) => (
                  <Marker key={log.id} position={[log.latitude!, log.longitude!]}>
                    <Popup>
                      <div>
                        <p><strong>Date:</strong> {log.timestamp.toDate().toLocaleDateString()}</p>
                        {log.vehicleId && userVehiclesMap.has(log.vehicleId) && (
                          <p><strong>Vehicle:</strong> {userVehiclesMap.get(log.vehicleId)}</p>
                        )}
                        <p><strong>Brand:</strong> {log.brand || 'N/A'}</p>
                        <p><strong>Cost:</strong> €{log.cost.toFixed(2)}</p>
                        <p><strong>Litres:</strong> {log.fuelAmountLiters.toFixed(2)} L</p>
                        <p><strong>Distance:</strong> {log.distanceKm.toFixed(1)} km</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
              <FitBoundsToMarkers points={filteredMapLocations} />
            </MapContainer>
          </div>
      )}
    </div>
  );
};

export default FuelMapPage;
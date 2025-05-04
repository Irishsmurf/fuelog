// src/context/VehicleContext.tsx
import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    ReactNode,
    useCallback // Import useCallback for memoizing functions
} from 'react';
import { Vehicle } from '../utils/types'; // Import the Vehicle type
import { fetchVehicles } from '../firebase/firestoreService'; // Import the function to fetch vehicles
import { useAuth } from './AuthContext'; // Assuming you have an AuthContext providing the user

// Define the shape of the context data
interface VehicleContextProps {
  vehicles: Vehicle[]; // List of the user's vehicles
  selectedVehicle: Vehicle | null; // The currently selected vehicle object
  setSelectedVehicleById: (vehicleId: string | null) => void; // Function to change selection based on vehicle document ID
  isLoadingVehicles: boolean; // Loading state for fetching vehicles
  vehicleError: string | null; // Error state for fetching vehicles
  refreshVehicles: () => void; // Function to manually trigger a reload of vehicles
}

// Create the context with an initial undefined value
const VehicleContext = createContext<VehicleContextProps | undefined>(undefined);

// Create the Provider component
export const VehicleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // Get the current authenticated user from AuthContext
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); // State to hold the list of vehicles
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null); // State for the currently selected vehicle
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true); // State to track loading status
  const [vehicleError, setVehicleError] = useState<string | null>(null); // State to store any fetching errors

  // Define the function to load vehicles, memoized with useCallback
  const loadVehicles = useCallback(async () => {
    // If there's no logged-in user, clear vehicle data and stop loading
    if (!user) {
      setVehicles([]);
      setSelectedVehicle(null);
      setIsLoadingVehicles(false);
      localStorage.removeItem('selectedVehicleId'); // Clear saved selection
      return;
    }

    // Start loading and clear previous errors
    setIsLoadingVehicles(true);
    setVehicleError(null);
    try {
      // Fetch vehicles from Firestore using the service function
      const fetchedVehicles = await fetchVehicles();
      setVehicles(fetchedVehicles);

      // Attempt to restore the previously selected vehicle from localStorage
      const savedVehicleId = localStorage.getItem('selectedVehicleId');
      let vehicleToSelect: Vehicle | null = null;

      if (savedVehicleId) {
        // Find the saved vehicle in the newly fetched list
        vehicleToSelect = fetchedVehicles.find(v => v.id === savedVehicleId) || null;
      }

      // If no saved selection or the saved vehicle wasn't found in the fetched list,
      // default to selecting the first vehicle in the list if available
      if (!vehicleToSelect && fetchedVehicles.length > 0) {
        vehicleToSelect = fetchedVehicles[0];
      }

      // Update the selectedVehicle state
      setSelectedVehicle(vehicleToSelect);

      // Update localStorage with the ID of the actually selected vehicle (or remove if none)
      if (vehicleToSelect) {
          localStorage.setItem('selectedVehicleId', vehicleToSelect.id);
      } else {
          localStorage.removeItem('selectedVehicleId');
      }

    } catch (err) {
      // Handle errors during fetching
      setVehicleError('Failed to load vehicles.');
      console.error("Error fetching vehicles in context:", err);
      // Clear state on error
      setVehicles([]);
      setSelectedVehicle(null);
      localStorage.removeItem('selectedVehicleId');
    } finally {
      // Ensure loading state is turned off
      setIsLoadingVehicles(false);
    }
  }, [user]); // This function depends on the user object

  // useEffect hook to load vehicles when the component mounts or the user changes
  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]); // Dependency array includes the memoized loadVehicles function

  // Function to allow components to change the selected vehicle
  const setSelectedVehicleById = (vehicleId: string | null) => {
    if (vehicleId === null) {
        // If null is passed, clear the selection
        setSelectedVehicle(null);
        localStorage.removeItem('selectedVehicleId');
    } else {
        // Find the vehicle object matching the provided ID
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (vehicle) {
            // If found, update state and localStorage
            setSelectedVehicle(vehicle);
            localStorage.setItem('selectedVehicleId', vehicle.id);
        } else {
            // If not found (e.g., invalid ID passed), clear the selection
            console.warn(`Attempted to select non-existent vehicle ID: ${vehicleId}`);
            setSelectedVehicle(null);
            localStorage.removeItem('selectedVehicleId');
        }
    }
  };

  // Function to allow manual refreshing of the vehicle list
  const refreshVehicles = () => {
      loadVehicles(); // Simply call the memoized load function again
  };

  // Provide the state and functions to consuming components
  return (
    <VehicleContext.Provider value={{
        vehicles,
        selectedVehicle,
        setSelectedVehicleById,
        isLoadingVehicles,
        vehicleError,
        refreshVehicles
     }}>
      {children}
    </VehicleContext.Provider>
  );
};

// Custom hook to easily consume the VehicleContext
export const useVehicle = (): VehicleContextProps => {
  const context = useContext(VehicleContext);
  // Ensure the hook is used within a VehicleProvider
  if (!context) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};

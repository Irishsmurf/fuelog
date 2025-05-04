// src/components/VehicleSelector.tsx
import React from 'react';
import { useVehicle } from '../context/VehicleContext'; // Adjust path
import { Car } from 'lucide-react'; // Example icon

const VehicleSelector: React.FC = () => {
  const {
    vehicles,
    selectedVehicle,
    setSelectedVehicleById,
    isLoadingVehicles,
    vehicleError
  } = useVehicle();

  const handleVehicleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = event.target.value;
    setSelectedVehicleById(vehicleId || null); // Update context
  };

  // Determine what to display while loading or if there's an error
  if (isLoadingVehicles) {
    // Don't show loading text if there might only be one vehicle eventually
    // return <div className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1">Loading...</div>;
    return null; // Or a very minimal loader if preferred
  }

  if (vehicleError) {
     // Optionally hide error if only one vehicle might exist
     // return <div className="text-sm text-red-500 px-2 py-1" title={vehicleError}>Error!</div>;
     return null;
  }

  // --- Conditional Rendering Logic ---
  // Only render the selector if there is more than one vehicle
  if (vehicles.length <= 1) {
      // If there's exactly one vehicle, it's automatically selected by the context,
      // so no need to show the selector. If zero, also nothing to show.
      return null;
  }

  // --- Render Selector (only if vehicles.length > 1) ---
  return (
    <div className="relative flex items-center">
       <Car size={18} className="text-gray-600 dark:text-gray-400 mr-1 ml-2 pointer-events-none" /> {/* Icon */}
       <select
          id="globalVehicleSelect"
          value={selectedVehicle?.id || ''} // Use selected vehicle from context
          onChange={handleVehicleChange} // Update context on change
          className="block appearance-none w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1 pl-2 pr-8 rounded-md leading-tight focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-500 text-sm"
          aria-label="Select Vehicle"
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {/* UPDATED TEXT FORMAT */}
              {`${vehicle.make} - ${vehicle.model} (${vehicle.registrationPlate})`}
            </option>
          ))}
        </select>
         {/* Dropdown arrow styling */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
    </div>
  );
};

export default VehicleSelector;

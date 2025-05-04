// src/components/VehicleManagementPage.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { Vehicle } from '../utils/types'; // Import the Vehicle type
import { fetchVehicles, addVehicle } from '../firebase/firestoreService'; // Import service functions
import { CarFront, PlusCircle } from 'lucide-react'; // Example icons

const VehicleManagementPage: React.FC = () => {
  // State for the list of vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for the "Add Vehicle" form
  const [registrationPlate, setRegistrationPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [fuelType, setFuelType] = useState<'Petrol' | 'Diesel' | 'Electric' | 'Hybrid' | 'Other'>('Petrol');
  const [initialOdometerKm, setInitialOdometerKm] = useState('');
  const [isAdding, setIsAdding] = useState<boolean>(false); // State for add operation
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch vehicles on component mount
  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedVehicles = await fetchVehicles();
      setVehicles(fetchedVehicles);
    } catch (err) {
      setError('Failed to load vehicles.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission to add a new vehicle
  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!registrationPlate || !make || !model || !initialOdometerKm) {
      setAddError('Please fill in all required fields.');
      return;
    }

    const odometer = parseFloat(initialOdometerKm);
    if (isNaN(odometer) || odometer < 0) {
      setAddError('Initial Odometer must be a valid positive number.');
      return;
    }

    setIsAdding(true);

    const newVehicleData = {
      registrationPlate: registrationPlate.toUpperCase().trim(), // Standardize format
      make: make.trim(),
      model: model.trim(),
      fuelType: fuelType,
      initialOdometerKm: odometer,
      currentOdometerKm: odometer, // Set currentOdometerKm to the same value as initialOdometerKm
      // lastOdometerKm will be set in addVehicle based on initial
    };

    const success = await addVehicle(newVehicleData);

    if (success) {
      // Clear form and reload list
      setRegistrationPlate('');
      setMake('');
      setModel('');
      setFuelType('Petrol');
      setInitialOdometerKm('');
      await loadVehicles(); // Refresh the list
    } else {
      setAddError('Failed to add vehicle. Please try again.');
    }
    setIsAdding(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Manage Vehicles</h1>

      {/* Display Loading State */}
      {isLoading && <p className="text-gray-600 dark:text-gray-400">Loading vehicles...</p>}

      {/* Display Fetching Error */}
      {error && <p className="text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-300 p-3 rounded-md mb-4">{error}</p>}

      {/* Vehicle List */}
      {!isLoading && !error && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Your Vehicles</h2>
          {vehicles.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">You haven't added any vehicles yet.</p>
          ) : (
            <ul className="space-y-3">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3">
                     <CarFront className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                     <div>
                        <p className="font-medium text-lg text-gray-900 dark:text-gray-100">{vehicle.make} {vehicle.model}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {vehicle.registrationPlate} - {vehicle.fuelType}
                        </p>
                     </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-300">
                    Odo: {vehicle.lastOdometerKm.toLocaleString()} km
                  </span>
                  {/* Add Edit/Delete buttons here later */}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add Vehicle Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Add New Vehicle</h2>
        <form onSubmit={handleAddVehicle} className="space-y-4">
          {/* Display Adding Error */}
          {addError && <p className="text-red-500 text-sm">{addError}</p>}

          {/* Registration Plate */}
          <div>
            <label htmlFor="registrationPlate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Plate (Unique ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="registrationPlate"
              value={registrationPlate}
              onChange={(e) => setRegistrationPlate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
              placeholder="e.g., 251D1234"
            />
          </div>

          {/* Make */}
          <div>
            <label htmlFor="make" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
              placeholder="e.g., Volkswagen"
            />
          </div>

          {/* Model */}
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
              placeholder="e.g., Polo TSI"
            />
          </div>

          {/* Fuel Type */}
          <div>
            <label htmlFor="fuelType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fuel Type <span className="text-red-500">*</span>
            </label>
            <select
              id="fuelType"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as Vehicle['fuelType'])}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Electric">Electric</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Initial Odometer */}
          <div>
            <label htmlFor="initialOdometerKm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Odometer (km) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="initialOdometerKm"
              value={initialOdometerKm}
              onChange={(e) => setInitialOdometerKm(e.target.value)}
              required
              min="0"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
              placeholder="Current reading in kilometers"
            />
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isAdding}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
            >
              {isAdding ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                 </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5 mr-2" /> Add Vehicle
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleManagementPage;
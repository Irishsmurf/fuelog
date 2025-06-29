// src/pages/VehiclesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Vehicle } from '../utils/types';
import VehicleCard from '../components/VehicleCard';
import VehicleForm from '../components/VehicleForm';
import { useAuth } from '../context/AuthContext';
import {
  addVehicle,
  fetchUserVehicles,
  updateVehicle,
  deleteVehicle,
} from '../firebase/firestoreService';

const VehiclesPage: React.FC = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Stores ID of vehicle being deleted

  const loadVehicles = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const userVehicles = await fetchUserVehicles();
      setVehicles(userVehicles);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      setError('Failed to load vehicles. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleOpenForm = (vehicle?: Vehicle) => {
    setVehicleToEdit(vehicle || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setVehicleToEdit(null);
  };

  const handleSaveVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'userId'>) => {
    if (!user) {
      setError('You must be logged in to save a vehicle.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (vehicleToEdit) {
        // Update existing vehicle
        const success = await updateVehicle(vehicleToEdit.id, vehicleData);
        if (!success) throw new Error('Update failed');
      } else {
        // Add new vehicle
        const newId = await addVehicle(vehicleData);
        if (!newId) throw new Error('Add failed');
      }
      await loadVehicles(); // Refresh the list
      handleCloseForm();
    } catch (err) {
      console.error('Error saving vehicle:', err);
      setError('Failed to save vehicle. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(vehicleId);
    setError(null);
    try {
      const success = await deleteVehicle(vehicleId);
      if (!success) throw new Error('Delete failed');
      // Also consider what to do with fuel logs associated with this vehicleId.
      // For now, just deleting the vehicle.
      setVehicles(prev => prev.filter(v => v.id !== vehicleId)); // Optimistic update or re-fetch
      // await loadVehicles(); // Or re-fetch
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      setError('Failed to delete vehicle. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-lg text-gray-600 dark:text-gray-400">Please log in to manage your vehicles.</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">My Vehicles</h1>
        <button
          onClick={() => handleOpenForm()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition duration-150 ease-in-out flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Vehicle
        </button>
      </div>

      {isLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading vehicles...</p>}
      {error && <p className="text-center text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900 p-3 rounded-md">{error}</p>}

      {!isLoading && !error && vehicles.length === 0 && (
        <div className="text-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 00-4-4H3V9a4 4 0 004-4h2a4 4 0 004 4v2m1 5a2 2 0 11-4 0 2 2 0 014 0zM19 13a2 2 0 11-4 0 2 2 0 014 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M19 9a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No vehicles added yet.</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding your first vehicle.</p>
          <div className="mt-6">
            <button
              onClick={() => handleOpenForm()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Your First Vehicle
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && vehicles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onEdit={() => handleOpenForm(vehicle)}
              onDelete={handleDeleteVehicle}
              isDeleting={isDeleting === vehicle.id}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <VehicleForm
          vehicleToEdit={vehicleToEdit}
          onSave={handleSaveVehicle}
          onCancel={handleCloseForm}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default VehiclesPage;

// src/components/VehicleForm.tsx
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Vehicle } from '../utils/types';

interface VehicleFormProps {
  vehicleToEdit?: Vehicle | null;
  onSave: (vehicleData: Omit<Vehicle, 'id' | 'userId'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicleToEdit, onSave, onCancel, isSaving }) => {
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<string>(''); // Keep as string for input control

  useEffect(() => {
    if (vehicleToEdit) {
      setName(vehicleToEdit.name);
      setMake(vehicleToEdit.make || '');
      setModel(vehicleToEdit.model || '');
      setYear(vehicleToEdit.year ? String(vehicleToEdit.year) : '');
    } else {
      // Reset form for new vehicle
      setName('');
      setMake('');
      setModel('');
      setYear('');
    }
  }, [vehicleToEdit]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vehicle name is required.');
      return;
    }

    const currentYear = new Date().getFullYear();
    let yearToSave: number | undefined = undefined;

    if (year) { // If year string is not empty
        const tempParsedYear = parseInt(year, 10);
        if (isNaN(tempParsedYear)) {
            // Show alert only if year string is not empty AND it's not a valid number
            alert('Year must be a valid number if provided.');
            return;
        }
        // Check range only if it's a valid number
        if (tempParsedYear < 1900 || tempParsedYear > currentYear + 1) {
            alert(`Please enter a valid year (e.g., between 1900 and ${currentYear + 1}).`);
            return;
        }
        yearToSave = tempParsedYear; // It's a valid number
    }
    // If year string was empty, yearToSave remains undefined, which is fine.

    onSave({
      name: name.trim(),
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: yearToSave, // Use the explicitly typed and validated yearToSave
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md m-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          {vehicleToEdit ? 'Edit Vehicle' : 'Add New Vehicle'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vehicleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Vehicle Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vehicleName"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              placeholder="e.g., My Blue Sedan"
            />
          </div>

          <div>
            <label htmlFor="vehicleMake" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Make (Optional)
            </label>
            <input
              type="text"
              id="vehicleMake"
              value={make}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMake(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="e.g., Toyota"
            />
          </div>

          <div>
            <label htmlFor="vehicleModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Model (Optional)
            </label>
            <input
              type="text"
              id="vehicleModel"
              value={model}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setModel(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="e.g., Camry"
            />
          </div>

          <div>
            <label htmlFor="vehicleYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Year (Optional)
            </label>
            <input
              type="number"
              id="vehicleYear"
              value={year}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setYear(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="e.g., 2023"
              min="1900"
              max={new Date().getFullYear() + 1}
              step="1"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleForm;

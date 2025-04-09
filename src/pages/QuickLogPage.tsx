// src/pages/QuickLogPage.tsx
import React, { JSX, useState, ChangeEvent, FormEvent } from 'react';
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

type MessageType = 'success' | 'error' | '';
interface MessageState {
  type: MessageType;
  text: string;
}

function QuickLogPage(): JSX.Element {
  const { user } = useAuth();
  const [brand, setBrand] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  // Changed state name for clarity, still takes string input
  const [distanceKmInput, setDistanceKmInput] = useState<string>('');
  const [fuelAmountLiters, setFuelAmountLiters] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to save.' });
      return;
    }
    // Use distanceKmInput for validation
    if (!cost || !distanceKmInput || !fuelAmountLiters) {
      setMessage({ type: 'error', text: 'Please fill in Cost, Distance, and Fuel Amount.' });
      return;
    }
    const parsedCost = parseFloat(cost);
    // Parse distanceKmInput
    const parsedDistanceKm = parseFloat(distanceKmInput);
    const parsedFuel = parseFloat(fuelAmountLiters);

    // Validate parsed values
    if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) {
        setMessage({ type: 'error', text: 'Cost, Distance (Km), and Fuel Amount must be valid positive numbers.' });
        return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await addDoc(collection(db, "fuelLogs"), {
        userId: user.uid,
        timestamp: Timestamp.now(),
        brand: brand.trim() || 'Unknown',
        cost: parsedCost,
        distanceKm: parsedDistanceKm, // Save distance directly as Km
        fuelAmountLiters: parsedFuel,
      });
      setBrand('');
      setCost('');
      setDistanceKmInput(''); // Clear Km input state
      setFuelAmountLiters('');
      setMessage({ type: 'success', text: 'Log saved successfully!' });
    } catch (error) {
      console.error("Error adding document: ", error);
      setMessage({ type: 'error', text: 'Error saving log. Please try again.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }
  };

  const messageStyle = message.type === 'error' ? 'text-red-600' : message.type === 'success' ? 'text-green-600' : 'text-gray-600';

  return (
    <div className="container mx-auto max-w-lg">
        <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Log New Fuel Entry</h2>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Brand Input (No change) */}
                <div>
                    <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                        Filling Station Brand <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <input
                        type="text" id="brand" value={brand} onChange={handleInputChange(setBrand)} placeholder="e.g., Circle K, Maxol"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        disabled={isSaving}
                    />
                </div>
                {/* Cost Input (No change) */}
                <div>
                    <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                        Total Cost (€) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number" inputMode="decimal" id="cost" value={cost} onChange={handleInputChange(setCost)} placeholder="e.g., 65.50" step="0.01" min="0.01" required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        disabled={isSaving} aria-describedby="cost-description"
                    />
                     <p id="cost-description" className="mt-1 text-xs text-gray-500">Enter the total amount paid.</p>
                </div>
                {/* Distance Input - Changed label and state */}
                <div>
                    <label htmlFor="distance" className="block text-sm font-medium text-gray-700 mb-1">
                        Distance Covered (Km) <span className="text-red-500">*</span> {/* Label updated */}
                    </label>
                    <input
                        type="number" inputMode="decimal" id="distance" value={distanceKmInput} onChange={handleInputChange(setDistanceKmInput)} placeholder="e.g., 500.5" step="0.1" min="0.1" required // Use distanceKmInput state
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        disabled={isSaving} aria-describedby="distance-description"
                    />
                     <p id="distance-description" className="mt-1 text-xs text-gray-500">Kilometers driven since last fill-up.</p> {/* Description updated */}
                </div>
                {/* Fuel Amount Input (No change) */}
                <div className="pb-2">
                    <label htmlFor="fuelAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Fuel Added (Litres) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number" inputMode="decimal" id="fuelAmount" value={fuelAmountLiters} onChange={handleInputChange(setFuelAmountLiters)} placeholder="e.g., 42.80" step="0.01" min="0.01" required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        disabled={isSaving} aria-describedby="fuel-description"
                    />
                    <p id="fuel-description" className="mt-1 text-xs text-gray-500">Amount of fuel added, in Litres.</p>
                </div>
                {/* Submit Button (No change) */}
                <button
                    type="submit" disabled={isSaving}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                >
                    {isSaving ? 'Saving...' : 'Save Fuel Log'}
                </button>
                {/* Feedback Message (No change) */}
                {message.text && ( <p className={`mt-4 text-center text-sm ${messageStyle}`}>{message.text}</p> )}
            </form>
        </div>
    </div>
  );
}

export default QuickLogPage;

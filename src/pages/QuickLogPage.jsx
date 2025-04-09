    // src/pages/QuickLogPage.jsx
    import React, { useState } from 'react';
    import { collection, addDoc, Timestamp } from "firebase/firestore";
    import { db } from '../firebase/config';
    import { useAuth } from '../context/AuthContext';

    function QuickLogPage() {
      const { user } = useAuth();
      const [brand, setBrand] = useState('');
      const [cost, setCost] = useState('');
      const [distance, setDistance] = useState('');
      const [fuelAmountLiters, setFuelAmountLiters] = useState('');
      const [isSaving, setIsSaving] = useState(false);
      const [message, setMessage] = useState({ type: '', text: '' });

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
          setMessage({ type: 'error', text: 'You must be logged in to save.' });
          return;
        }
        if (!cost || !distance || !fuelAmountLiters) {
          setMessage({ type: 'error', text: 'Please fill in Cost, Distance, and Fuel Amount.' });
          return;
        }
        const parsedCost = parseFloat(cost);
        const parsedDistance = parseFloat(distance);
        const parsedFuel = parseFloat(fuelAmountLiters);

        if (isNaN(parsedCost) || isNaN(parsedDistance) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistance <= 0 || parsedFuel <= 0) {
            setMessage({ type: 'error', text: 'Cost, Distance, and Fuel Amount must be valid positive numbers.' });
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
            distanceMiles: parsedDistance,
            fuelAmountLiters: parsedFuel,
          });
          setBrand('');
          setCost('');
          setDistance('');
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
        // Centered container, max width for the form card
        <div className="container mx-auto max-w-lg"> {/* Adjusted max-width slightly */}
            {/* Card container with slightly more padding and refined shadow/border */}
            <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-200">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Log New Fuel Entry</h2>
                <form onSubmit={handleSubmit} noValidate className="space-y-4"> {/* Use space-y for consistent vertical spacing */}
                    {/* Brand Input */}
                    <div> {/* Wrap label/input group */}
                        <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                            Filling Station Brand <span className="text-gray-500 text-xs">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            id="brand"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="e.g., Circle K, Maxol"
                            // Added focus:ring-offset-1 for better visibility on focus
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Cost Input */}
                    <div>
                        <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                            Total Cost (€) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="cost"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            placeholder="e.g., 65.50"
                            step="0.01"
                            min="0.01"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            disabled={isSaving}
                            aria-describedby="cost-description"
                        />
                         <p id="cost-description" className="mt-1 text-xs text-gray-500">Enter the total amount paid.</p>
                    </div>

                    {/* Distance Input */}
                    <div>
                        <label htmlFor="distance" className="block text-sm font-medium text-gray-700 mb-1">
                            Distance Covered (Miles) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="distance"
                            value={distance}
                            onChange={(e) => setDistance(e.target.value)}
                            placeholder="e.g., 310.5"
                            step="0.1"
                             min="0.1"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            disabled={isSaving}
                            aria-describedby="distance-description"
                        />
                         <p id="distance-description" className="mt-1 text-xs text-gray-500">Miles driven since last fill-up.</p>
                    </div>

                    {/* Fuel Amount Input */}
                    <div className="pb-2"> {/* Add padding bottom before button */}
                        <label htmlFor="fuelAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Fuel Added (Litres) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="fuelAmount"
                            value={fuelAmountLiters}
                            onChange={(e) => setFuelAmountLiters(e.target.value)}
                            placeholder="e.g., 42.80"
                            step="0.01"
                             min="0.01"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            disabled={isSaving}
                             aria-describedby="fuel-description"
                        />
                        <p id="fuel-description" className="mt-1 text-xs text-gray-500">Amount of fuel added, in Litres.</p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                    >
                        {isSaving ? 'Saving...' : 'Save Fuel Log'}
                    </button>

                    {/* Feedback Message */}
                    {message.text && (
                        <p className={`mt-4 text-center text-sm ${messageStyle}`}>
                            {message.text}
                        </p>
                    )}
                </form>
            </div>
        </div>
      );
    }

    export default QuickLogPage;
    
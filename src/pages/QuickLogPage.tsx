// src/pages/QuickLogPage.tsx (or similar component name)
import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { Timestamp, addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config'; // Adjust path
import { useAuth } from '../context/AuthContext'; // Adjust path
import { useVehicle } from '../context/VehicleContext'; // Import the vehicle context hook
import { FuelLogData, Log } from '../utils/types'; // Adjust path
import { Fuel, Droplet, MapPin, Milestone, Gauge } from 'lucide-react'; // Example icons
import VehicleSelector from '../components/VehicleSelector';

const QuickLogPage: React.FC = () => {
    const { user } = useAuth();
    // Get vehicle state and functions from the context
    const { vehicles, selectedVehicle, setSelectedVehicleById, isLoadingVehicles, vehicleError } = useVehicle();

    // Form state
    const [brand, setBrand] = useState('');
    const [cost, setCost] = useState('');
    const [fuelAmountLiters, setFuelAmountLiters] = useState('');
    // Mileage input state
    const [mileageInputMethod, setMileageInputMethod] = useState<'distance' | 'odometer'>('distance');
    const [distanceKm, setDistanceKm] = useState('');
    const [odometerKm, setOdometerKm] = useState('');
    // Location state
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [currentLatitude, setCurrentLatitude] = useState<number | undefined>(undefined);
    const [currentLongitude, setCurrentLongitude] = useState<number | undefined>(undefined);
    const [locationAccuracy, setLocationAccuracy] = useState<number | undefined>(undefined);
    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

    // Reset form fields
    const resetForm = () => {
        setBrand('');
        setCost('');
        setFuelAmountLiters('');
        setDistanceKm('');
        setOdometerKm('');
        // Keep mileageInputMethod? Or reset? setMileageInputMethod('distance');
        setLocationError(null);
        setSubmitError(null);
        setSubmitSuccess(null);
        setCurrentLatitude(undefined);
        setCurrentLongitude(undefined);
        setLocationAccuracy(undefined);
    };

    // Get location handler
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setIsGettingLocation(true);
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCurrentLatitude(position.coords.latitude);
                setCurrentLongitude(position.coords.longitude);
                setLocationAccuracy(position.coords.accuracy);
                setIsGettingLocation(false);
                console.log("Location acquired:", position.coords);
            },
            (error) => {
                console.error("Geolocation error:", error);
                setLocationError(`Failed to get location: ${error.message}`);
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } // Options
        );
    };

    // Firestore function to add the log (consider moving to firestoreService)
    const addFuelLog = async (logData: FuelLogData): Promise<boolean> => {
        try {
            // Ensure no undefined values are passed (Firestore SDK might handle some, but explicit is safer)
            const dataToSend = { ...logData };
            Object.keys(dataToSend).forEach(key => {
                if (dataToSend[key as keyof FuelLogData] === undefined) {
                    delete dataToSend[key as keyof FuelLogData];
                }
            });

            await addDoc(collection(db, 'fuelLogs'), dataToSend);
            console.log("Fuel log added successfully.");
            return true;
        } catch (error) {
            console.error("Error adding fuel log: ", error);
            setSubmitError(`Error saving log: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    };

     // Firestore function to update vehicle odometer (consider moving to firestoreService)
     const updateVehicleOdometer = async (vehicleDocId: string, newOdometerReading: number): Promise<boolean> => {
        if (!vehicleDocId) return false;
        try {
            const vehicleRef = doc(db, 'vehicles', vehicleDocId);
            await updateDoc(vehicleRef, {
                lastOdometerKm: newOdometerReading
            });
            console.log(`Vehicle ${vehicleDocId} odometer updated to ${newOdometerReading}`);
            return true;
        } catch (error) {
            console.error(`Error updating odometer for vehicle ${vehicleDocId}:`, error);
            // Don't necessarily block log submission, but log the error
            setSubmitError(prev => prev ? `${prev}\nFailed to update vehicle odometer.` : "Failed to update vehicle odometer.");
            return false;
        }
    };

    // Form submission handler
    const handleAddLog = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        setSubmitSuccess(null);

        if (!user) {
            setSubmitError("You must be logged in to add a log.");
            return;
        }
        // Ensure a vehicle is selected
        if (!selectedVehicle) {
            setSubmitError("Please select a vehicle.");
            return;
        }
        // Basic validation
        const costVal = parseFloat(cost);
        const litersVal = parseFloat(fuelAmountLiters);
        // Parse values, NaN if invalid or empty
        const distanceVal = mileageInputMethod === 'distance' ? parseFloat(distanceKm) : NaN;
        const odometerVal = mileageInputMethod === 'odometer' ? parseFloat(odometerKm) : NaN;

        if (isNaN(costVal) || costVal <= 0 || isNaN(litersVal) || litersVal <= 0) {
            setSubmitError("Please enter valid positive numbers for Cost and Litres.");
            return;
        }
        // Validate the relevant mileage field based on the selected method
        if (mileageInputMethod === 'distance' && (isNaN(distanceVal) || distanceVal < 0)) {
             setSubmitError("Please enter a valid non-negative number for Distance.");
             return;
        }
         if (mileageInputMethod === 'odometer' && (isNaN(odometerVal) || odometerVal < selectedVehicle.lastOdometerKm)) {
             setSubmitError(`Odometer reading must be a valid number and cannot be less than the last reading (${selectedVehicle.lastOdometerKm.toLocaleString()} km).`);
             return;
         }


        setIsSubmitting(true);

        // --- FIX: Conditionally build the data object ---
        const newLogData: FuelLogData = {
            userId: user.uid,
            vehicleId: selectedVehicle.id,
            timestamp: Timestamp.now(),
            brand: brand.trim() || 'Unknown',
            cost: costVal,
            fuelAmountLiters: litersVal,
            mileageInputMethod: mileageInputMethod,
            // Only include fields if they have valid values
            ...(currentLatitude !== undefined && { latitude: currentLatitude }),
            ...(currentLongitude !== undefined && { longitude: currentLongitude }),
            ...(locationAccuracy !== undefined && { locationAccuracy: locationAccuracy }),
            ...(mileageInputMethod === 'distance' && !isNaN(distanceVal) && { distanceKm: distanceVal }),
            ...(mileageInputMethod === 'odometer' && !isNaN(odometerVal) && { odometerKm: odometerVal }),
        };
        // --- End FIX ---

        const logAdded = await addFuelLog(newLogData);

        let odometerUpdated = false;
        if (logAdded) {
            // If log added successfully, update the vehicle's odometer
            let newOdometerReading: number | undefined;
            // Use the validated numeric values directly
            if (mileageInputMethod === 'odometer' && !isNaN(odometerVal)) {
                newOdometerReading = odometerVal;
            } else if (mileageInputMethod === 'distance' && !isNaN(distanceVal)) {
                // Ensure distanceVal is treated as a number here
                newOdometerReading = selectedVehicle.lastOdometerKm + distanceVal;
            }

            if (newOdometerReading !== undefined) {
                 odometerUpdated = await updateVehicleOdometer(selectedVehicle.id, newOdometerReading);
                 // Optionally refresh vehicle context if update succeeded
                 // if (odometerUpdated) { refreshVehicles(); } // Might cause quick re-render, consider if needed
            } else {
                odometerUpdated = true; // No update needed is also a "success"
            }
        }


        setIsSubmitting(false);

        if (logAdded && odometerUpdated) {
            setSubmitSuccess("Fuel log added successfully!");
            resetForm();
            // Maybe navigate away or clear success message after a delay
            setTimeout(() => setSubmitSuccess(null), 3000);
        }
        // Error message is set within addFuelLog or updateVehicleOdometer if they fail
    };

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-lg">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Quick Fuel Log</h1>

            <form onSubmit={handleAddLog} className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">

                {/* Vehicle Selector */}
                <VehicleSelector />

                {/* Brand */}
                <div>
                    <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filling Station Brand</label>
                    <input
                        type="text"
                        id="brand"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                        placeholder="e.g., Circle K, Maxol"
                        list="brand-suggestions"
                    />
                    {/* Add datalist for suggestions if needed */}
                </div>

                {/* Cost */}
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                     <span className="pl-3 pr-2 text-gray-500 dark:text-gray-400">€</span>
                    <input
                        type="number"
                        id="cost"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        required
                        min="0.01"
                        step="0.01"
                        className="flex-1 px-1 py-2 border-0 rounded-r-md focus:ring-0 dark:bg-gray-700 dark:text-gray-200"
                        placeholder="Total Cost"
                    />
                </div>

                {/* Fuel Amount */}
                 <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                     <span className="pl-3 pr-2 text-gray-500 dark:text-gray-400"><Droplet size={16}/></span>
                    <input
                        type="number"
                        id="fuelAmountLiters"
                        value={fuelAmountLiters}
                        onChange={(e) => setFuelAmountLiters(e.target.value)}
                        required
                        min="0.01"
                        step="0.01"
                        className="flex-1 px-1 py-2 border-0 focus:ring-0 dark:bg-gray-700 dark:text-gray-200"
                        placeholder="Fuel Added"
                    />
                     <span className="px-3 text-gray-500 dark:text-gray-400">Litres</span>
                </div>

                {/* Mileage Input Method Toggle */}
                <div className="pt-2">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mileage Input Method</label>
                     <div className="flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => setMileageInputMethod('distance')}
                            className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md focus:z-10 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${mileageInputMethod === 'distance' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500'}`}
                        >
                            <Milestone size={16} className="inline mr-1" /> Distance Driven
                        </button>
                        <button
                            type="button"
                            onClick={() => setMileageInputMethod('odometer')}
                            className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md focus:z-10 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${mileageInputMethod === 'odometer' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 -ml-px'}`}
                        >
                           <Gauge size={16} className="inline mr-1" /> Odometer Reading
                        </button>
                     </div>
                </div>

                {/* Conditional Mileage Input */}
                {mileageInputMethod === 'distance' ? (
                    <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                        <span className="pl-3 pr-2 text-gray-500 dark:text-gray-400"><Milestone size={16}/></span>
                        <input
                            type="number"
                            id="distanceKm"
                            value={distanceKm}
                            onChange={(e) => setDistanceKm(e.target.value)}
                            required={mileageInputMethod === 'distance'} // Only require if this method is selected
                            min="0"
                            step="0.1"
                            className="flex-1 px-1 py-2 border-0 focus:ring-0 dark:bg-gray-700 dark:text-gray-200"
                            placeholder="Distance Since Last Fill"
                        />
                        <span className="px-3 text-gray-500 dark:text-gray-400">km</span>
                    </div>
                ) : (
                     <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                        <span className="pl-3 pr-2 text-gray-500 dark:text-gray-400"><Gauge size={16}/></span>
                        <input
                            type="number"
                            id="odometerKm"
                            value={odometerKm}
                            onChange={(e) => setOdometerKm(e.target.value)}
                            required={mileageInputMethod === 'odometer'} // Only require if this method is selected
                            min={selectedVehicle ? selectedVehicle.lastOdometerKm : 0} // Prevent going backwards
                            step="0.1"
                            className="flex-1 px-1 py-2 border-0 focus:ring-0 dark:bg-gray-700 dark:text-gray-200"
                            placeholder={`Current Odometer (last: ${selectedVehicle?.lastOdometerKm.toLocaleString() ?? 'N/A'})`}
                            disabled={!selectedVehicle} // Disable if no vehicle selected
                        />
                         <span className="px-3 text-gray-500 dark:text-gray-400">km</span>
                    </div>
                )}

                {/* Location */}
                <div className="pt-2">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location (Optional)</label>
                     <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isGettingLocation}
                        className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                     >
                        {isGettingLocation ? (
                             <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Getting Location...
                             </>
                        ) : currentLatitude ? (
                             <>
                                <MapPin size={16} className="mr-2 text-green-500" /> Location Acquired (Accuracy: {locationAccuracy?.toFixed(0)}m)
                             </>
                        ) : (
                             <>
                                <MapPin size={16} className="mr-2" /> Get Current Location
                             </>
                        )}
                     </button>
                     {locationError && <p className="text-red-500 text-xs mt-1">{locationError}</p>}
                </div>

                {/* Submit Button */}
                <div className="pt-3">
                    <button
                        type="submit"
                        disabled={isSubmitting || !selectedVehicle || isLoadingVehicles} // Disable if submitting or no vehicle selected/loading
                        className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
                    >
                        {isSubmitting ? (
                             <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Submitting...
                             </>
                        ) : (
                            <>
                                <Fuel size={18} className="mr-2" /> Add Fuel Log
                            </>
                        )}
                    </button>
                </div>

                {/* Status Messages */}
                {submitError && <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">{submitError}</p>}
                {submitSuccess && <p className="text-green-600 dark:text-green-400 text-sm mt-2 text-center">{submitSuccess}</p>}

            </form>
        </div>
    );
};

export default QuickLogPage;

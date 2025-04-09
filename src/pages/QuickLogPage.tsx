// src/pages/QuickLogPage.tsx
import React, { JSX, useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

// Types
type MessageType = 'success' | 'error' | 'info' | ''; // Added 'info' type
interface MessageState {
  type: MessageType;
  text: string;
}
// Type for location data we want to store
interface LocationData {
    latitude: number;
    longitude: number;
    locationAccuracy: number;
}


function QuickLogPage(): JSX.Element {
  const { user } = useAuth();
  const [brand, setBrand] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [distanceKmInput, setDistanceKmInput] = useState<string>('');
  const [fuelAmountLiters, setFuelAmountLiters] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false); // Combined loading state
  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState<boolean>(false);

  // --- Fetch known brands effect (same as before) ---
  useEffect(() => {
    if (!user) { setKnownBrands([]); return; }
    const fetchBrands = async () => {
      setIsLoadingBrands(true);
      try {
        const q = query(collection(db, "fuelLogs"), where("userId", "==", user.uid));
        const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
        const brands = new Set<string>();
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.brand && data.brand.toLowerCase() !== 'unknown') { brands.add(data.brand.trim()); }
        });
        const sortedBrands = Array.from(brands).sort((a, b) => a.localeCompare(b));
        setKnownBrands(sortedBrands);
      } catch (error) { console.error("Error fetching known brands:", error); }
      finally { setIsLoadingBrands(false); }
    };
    fetchBrands();
  }, [user]);

  // --- Input Change Handler (same as before) ---
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: ChangeEvent<HTMLInputElement>) => { setter(e.target.value); };

  // --- Function to get Geolocation wrapped in a Promise ---
  const getCurrentLocation = (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        resolve(null); // Resolve with null if API not available
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success: resolve with coordinates and accuracy
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            locationAccuracy: position.coords.accuracy,
          });
        },
        (error) => {
          // Error: log the error and resolve with null
          console.warn(`Geolocation error (${error.code}): ${error.message}`);
          resolve(null);
        },
        {
          // Options: enable high accuracy, set timeout, max age
          enableHighAccuracy: true, // Try for more accurate GPS reading
          timeout: 10000, // 10 seconds timeout
          maximumAge: 60000 // Accept cached position up to 1 minute old
        }
      );
    });
  };


  // --- Form Submit Handler (Updated for Geolocation) ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basic validation (same as before)
    if (!user) { setMessage({ type: 'error', text: 'You must be logged in to save.' }); return; }
    if (!cost || !distanceKmInput || !fuelAmountLiters) { setMessage({ type: 'error', text: 'Please fill in Cost, Distance, and Fuel Amount.' }); return; }
    const parsedCost = parseFloat(cost); const parsedDistanceKm = parseFloat(distanceKmInput); const parsedFuel = parseFloat(fuelAmountLiters);
    if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) { setMessage({ type: 'error', text: 'Cost, Distance (Km), and Fuel Amount must be valid positive numbers.' }); return; }

    setIsSaving(true); // Indicate process started
    setMessage({ type: 'info', text: 'Attempting to get location...' }); // New info message

    // --- Get Location ---
    const locationData = await getCurrentLocation();
    let locationMessage = "Location not captured."; // Default message if location fails
    if (locationData) {
        locationMessage = `Location captured (Accuracy: ${locationData.locationAccuracy.toFixed(0)}m).`;
    } else if (!navigator.geolocation) {
        locationMessage = "Location not supported by browser.";
    }
    // --- End Get Location ---

    setMessage({ type: 'info', text: `${locationMessage} Saving log...` }); // Update message

    try {
      // Prepare data object, including location if available
      const logData: any = { // Use 'any' or define a more specific type including optional location
        userId: user.uid,
        timestamp: Timestamp.now(),
        brand: brand.trim() || 'Unknown',
        cost: parsedCost,
        distanceKm: parsedDistanceKm,
        fuelAmountLiters: parsedFuel,
      };
      if (locationData) {
        logData.latitude = locationData.latitude;
        logData.longitude = locationData.longitude;
        logData.locationAccuracy = locationData.locationAccuracy;
      }

      // Save to Firestore
      await addDoc(collection(db, "fuelLogs"), logData);

      // Clear form on success
      setBrand(''); setCost(''); setDistanceKmInput(''); setFuelAmountLiters('');
      setMessage({ type: 'success', text: `Log saved successfully! ${locationData ? '' : '(Location not captured)'}` }); // Indicate if location was missed

    } catch (error) {
      console.error("Error adding document: ", error);
      setMessage({ type: 'error', text: 'Error saving log. Please try again.' });
    } finally {
      setIsSaving(false); // Indicate process finished
      setTimeout(() => setMessage({ type: '', text: '' }), 5000); // Longer timeout for message
    }
  };

  // --- Render Logic ---
  const messageStyle = message.type === 'error' ? 'text-red-600' : message.type === 'success' ? 'text-green-600' : 'text-blue-600'; // Blue for info

  return (
    <div className="container mx-auto max-w-lg">
        <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Log New Fuel Entry</h2>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Brand Input with Datalist (same as before) */}
                <div>
                    <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Filling Station Brand <span className="text-gray-500 text-xs">(Optional)</span></label>
                    <input type="text" id="brand" value={brand} onChange={handleInputChange(setBrand)} placeholder="e.g., Circle K, Maxol (start typing...)" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out" disabled={isSaving || isLoadingBrands} list="brand-suggestions" autoComplete="off"/>
                    <datalist id="brand-suggestions">{knownBrands.map((b) => ( <option key={b} value={b} /> ))}</datalist>
                </div>
                {/* Cost Input (same as before) */}
                <div>
                    <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">Total Cost (€) <span className="text-red-500">*</span></label>
                    <input type="number" inputMode="decimal" id="cost" value={cost} onChange={handleInputChange(setCost)} placeholder="e.g., 65.50" step="0.01" min="0.01" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out" disabled={isSaving} aria-describedby="cost-description"/>
                    <p id="cost-description" className="mt-1 text-xs text-gray-500">Enter the total amount paid.</p>
                </div>
                {/* Distance Input (same as before) */}
                <div>
                    <label htmlFor="distance" className="block text-sm font-medium text-gray-700 mb-1">Distance Covered (Km) <span className="text-red-500">*</span></label>
                    <input type="number" inputMode="decimal" id="distance" value={distanceKmInput} onChange={handleInputChange(setDistanceKmInput)} placeholder="e.g., 500.5" step="0.1" min="0.1" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out" disabled={isSaving} aria-describedby="distance-description"/>
                    <p id="distance-description" className="mt-1 text-xs text-gray-500">Kilometers driven since last fill-up.</p>
                </div>
                {/* Fuel Amount Input (same as before) */}
                <div className="pb-2">
                    <label htmlFor="fuelAmount" className="block text-sm font-medium text-gray-700 mb-1">Fuel Added (Litres) <span className="text-red-500">*</span></label>
                    <input type="number" inputMode="decimal" id="fuelAmount" value={fuelAmountLiters} onChange={handleInputChange(setFuelAmountLiters)} placeholder="e.g., 42.80" step="0.01" min="0.01" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out" disabled={isSaving} aria-describedby="fuel-description"/>
                    <p id="fuel-description" className="mt-1 text-xs text-gray-500">Amount of fuel added, in Litres.</p>
                </div>

                {/* Submit Button - Text updates based on state */}
                <button type="submit" disabled={isSaving || isLoadingBrands} className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                    {isSaving ? (message.text.includes('location') ? 'Getting Location...' : 'Saving...') : 'Save Fuel Log'}
                </button>

                {/* Feedback Message */}
                {message.text && ( <p className={`mt-4 text-center text-sm ${messageStyle} ${isSaving && message.type === 'info' ? 'animate-pulse' : ''}`}>{message.text}</p> )}
            </form>
        </div>
    </div>
  );
}

export default QuickLogPage;

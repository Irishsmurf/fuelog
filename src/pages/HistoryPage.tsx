// src/pages/HistoryPage.tsx
import React, { JSX, useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from '../firebase/config'; // Import db instance
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

// Define the structure of a log entry from Firestore
interface FuelLogData {
  userId: string;
  timestamp: Timestamp; // Use Firestore Timestamp type
  brand: string;
  cost: number;
  distanceMiles: number;
  fuelAmountLiters: number;
}

// Define the structure for logs state, including the document ID
interface Log extends FuelLogData {
  id: string;
}

// Conversion factor: Litres to UK Gallons
const LITRES_TO_UK_GALLONS = 4.54609;

function HistoryPage(): JSX.Element {
  const { user } = useAuth(); // Get current user
  const [logs, setLogs] = useState<Log[]>([]); // State to hold fetched logs
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [error, setError] = useState<string | null>(null); // Error state

  useEffect(() => {
    // Don't query if user isn't logged in or already loading
    if (!user) {
      setIsLoading(false);
      return;
    };

    setIsLoading(true); // Set loading true when starting fetch
    setError(null); // Clear previous errors

    // Create a Firestore query to get logs for the current user, ordered by date
    const q = query(
      collection(db, "fuelLogs"),
      where("userId", "==", user.uid), // Filter by user ID
      orderBy("timestamp", "desc")     // Order by timestamp, newest first
    );

    // Set up a real-time listener with onSnapshot
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logsData: Log[] = [];
      querySnapshot.forEach((doc) => {
        // Combine document ID and data, ensuring data matches FuelLogData structure
        logsData.push({ id: doc.id, ...(doc.data() as FuelLogData) });
      });
      setLogs(logsData); // Update state with fetched logs
      setIsLoading(false); // Set loading false after fetch/update
    }, (err) => {
      // Handle errors during fetch
      console.error("Error fetching fuel logs:", err);
      setError("Failed to load fuel history. Please try again later.");
      setIsLoading(false); // Set loading false even on error
    });

    // Cleanup function: Unsubscribe from the listener when the component unmounts or user changes
    return () => {
      console.log("Unsubscribing from fuel logs listener");
      unsubscribe();
    };

  }, [user]); // Re-run effect if the user object changes

  // --- Calculation Functions ---

  const calculateMPG = (distanceMiles: number, fuelAmountLiters: number): string => {
    // Basic validation for calculation inputs
    if (!distanceMiles || distanceMiles <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) {
      return 'N/A'; // Not applicable if distance or fuel is zero/invalid
    }
    try {
      const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS;
      const mpg = distanceMiles / gallonsUK;
      return mpg.toFixed(2); // Format to 2 decimal places
    } catch {
      return 'Error'; // Handle potential calculation errors
    }
  };

  const calculateCostPerMile = (cost: number, distanceMiles: number): string => {
    // Basic validation
    if (!cost || cost <= 0 || !distanceMiles || distanceMiles <= 0) {
      return 'N/A';
    }
    try {
      const costPerMile = cost / distanceMiles;
      // Format as currency (e.g., €0.123) - adjust formatting as needed
      return `€${costPerMile.toFixed(3)}`;
    } catch {
      return 'Error';
    }
  };

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 animate-pulse">Loading fuel history...</p>
        {/* Optional: Add a spinner */}
      </div>
    );
  }

  if (error) {
     return (
        <div className="text-center py-10 px-4">
            <p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p>
        </div>
     );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600">No fuel logs found. Add your first entry!</p>
      </div>
    );
  }

  // Render the table if logs exist
  return (
    <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">Fuel Log History</h2>
      {/* Container to make table scroll horizontally on small screens */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Define table headers */}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (€)</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (Mi)</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MPG</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Mile</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Map over the logs array to create table rows */}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {/* Format Firestore Timestamp to readable date */}
                  {log.timestamp?.toDate().toLocaleDateString() ?? 'N/A'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.brand}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.cost?.toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.distanceMiles?.toFixed(1)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.fuelAmountLiters?.toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">
                  {/* Display calculated MPG */}
                  {calculateMPG(log.distanceMiles, log.fuelAmountLiters)}
                </td>
                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                   {/* Display calculated Cost/Mile */}
                   {calculateCostPerMile(log.cost, log.distanceMiles)}
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HistoryPage;

// src/pages/HistoryPage.tsx
import React, { JSX, useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

// Update interface to use distanceKm
interface FuelLogData {
  userId: string;
  timestamp: Timestamp;
  brand: string;
  cost: number;
  distanceKm: number; // Changed from distanceMiles
  fuelAmountLiters: number;
}

interface Log extends FuelLogData {
  id: string;
}

// Conversion factors
const LITRES_TO_UK_GALLONS = 4.54609;
const KM_TO_MILES = 1 / 1.60934;

function HistoryPage(): JSX.Element {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; };
    setIsLoading(true); setError(null);

    const q = query(
      collection(db, "fuelLogs"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logsData: Log[] = [];
      querySnapshot.forEach((doc) => {
        // Ensure data matches updated FuelLogData structure
        logsData.push({ id: doc.id, ...(doc.data() as FuelLogData) });
      });
      setLogs(logsData);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching fuel logs:", err);
      setError("Failed to load fuel history."); setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Calculation Functions ---

  // Calculates MPG (UK) from Km and Litres
  const calculateMPG = (distanceKm: number, fuelAmountLiters: number): string => {
    if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
    try {
      const distanceMiles = distanceKm * KM_TO_MILES; // Convert Km to Miles here
      const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS;
      const mpg = distanceMiles / gallonsUK;
      return mpg.toFixed(2);
    } catch { return 'Error'; }
  };

  // Calculates Cost per Mile from Cost and Km
  const calculateCostPerMile = (cost: number, distanceKm: number): string => {
    if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A';
    try {
      const distanceMiles = distanceKm * KM_TO_MILES; // Convert Km to Miles here
      const costPerMile = cost / distanceMiles;
      return `€${costPerMile.toFixed(3)}`; // Format as currency
    } catch { return 'Error'; }
  };

  // Calculates Km per Litre
  const calculateKmL = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try {
          const kml = distanceKm / fuelAmountLiters;
          return kml.toFixed(2);
      } catch { return 'Error'; }
  };

  // Calculates Litres per 100 Km
  const calculateL100km = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try {
          const l100km = (fuelAmountLiters / distanceKm) * 100;
          return l100km.toFixed(2);
      } catch { return 'Error'; }
  };


  // --- Render Logic ---

  if (isLoading) { /* ... loading indicator ... */ }
  if (error) { /* ... error message ... */ }
  if (logs.length === 0) { /* ... no logs message ... */ }

  return (
    <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">Fuel Log History</h2>
      <div className="overflow-x-auto">
        {/* Updated Table Headers */}
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (€)</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (Km)</th> {/* Updated */}
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">km/L</th> {/* New */}
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">L/100km</th> {/* New */}
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MPG (UK)</th> {/* Clarified */}
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Mile</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{log.timestamp?.toDate().toLocaleDateString() ?? 'N/A'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{log.brand}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.cost?.toFixed(2)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.distanceKm?.toFixed(1)}</td> {/* Display Km */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.fuelAmountLiters?.toFixed(2)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{calculateKmL(log.distanceKm, log.fuelAmountLiters)}</td> {/* Display km/L */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{calculateL100km(log.distanceKm, log.fuelAmountLiters)}</td> {/* Display L/100km */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{calculateMPG(log.distanceKm, log.fuelAmountLiters)}</td> {/* Calc uses Km */}
                 <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{calculateCostPerMile(log.cost, log.distanceKm)}</td> {/* Calc uses Km */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
       {/* Loading/Error/Empty states need to be added back here */}
        {isLoading && <div className="text-center py-10"><p className="text-gray-500 animate-pulse">Loading fuel history...</p></div>}
        {error && <div className="text-center py-10 px-4"><p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p></div>}
        {!isLoading && !error && logs.length === 0 && <div className="text-center py-10"><p className="text-gray-600">No fuel logs found. Add your first entry!</p></div>}
    </div>
  );
}

export default HistoryPage;


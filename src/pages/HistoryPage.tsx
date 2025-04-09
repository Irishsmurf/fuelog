// src/pages/HistoryPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Interfaces
interface FuelLogData {
  userId: string;
  timestamp: Timestamp;
  brand: string;
  cost: number;
  distanceKm: number;
  fuelAmountLiters: number;
}
interface Log extends FuelLogData {
  id: string;
}
interface ChartDataPoint {
    date: string;
    timestampValue: number;
    mpg: number | null;
    cost: number | null;
    fuelPrice: number | null;
}

// Conversion factors
const LITRES_TO_UK_GALLONS = 4.54609;
const KM_TO_MILES = 1 / 1.60934;


function HistoryPage(): JSX.Element {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('Copy Table Data');

  useEffect(() => {
    // Firestore listener logic
    if (!user) { setIsLoading(false); return; };
    setIsLoading(true); setError(null);
    const q = query(collection(db, "fuelLogs"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logsData: Log[] = [];
      querySnapshot.forEach((doc) => { logsData.push({ id: doc.id, ...(doc.data() as FuelLogData) }); });
      setLogs(logsData); setIsLoading(false);
    }, (err) => { console.error("Error fetching fuel logs:", err); setError("Failed to load fuel history."); setIsLoading(false); });
    return () => unsubscribe();
  }, [user]);

  // --- Calculation Functions for Display (return string or 'N/A') ---
  const formatMPG = (distanceKm: number, fuelAmountLiters: number): string => {
    if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
    try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; const mpg = distanceMiles / gallonsUK; return mpg.toFixed(2); } catch { return 'Error'; } };
  const formatCostPerMile = (cost: number, distanceKm: number): string => {
    if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A';
    try { const distanceMiles = distanceKm * KM_TO_MILES; const costPerMile = cost / distanceMiles; return `€${costPerMile.toFixed(3)}`; } catch { return 'Error'; } };
  const formatKmL = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try { const kml = distanceKm / fuelAmountLiters; return kml.toFixed(2); } catch { return 'Error'; } };
  const formatL100km = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try { const l100km = (fuelAmountLiters / distanceKm) * 100; return l100km.toFixed(2); } catch { return 'Error'; } };

  // --- Calculation Functions for Charts (return number or null) ---
  const getNumericMPG = (distanceKm: number, fuelAmountLiters: number): number | null => {
    if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
    try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; return distanceMiles / gallonsUK; } catch { return null; } };
  const getNumericFuelPrice = (cost: number, fuelAmountLiters: number): number | null => {
      if (!cost || cost <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
      try { return cost / fuelAmountLiters; } catch { return null; } };

  // --- Prepare Data for Charts using useMemo ---
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!logs || logs.length === 0) return [];
    const sortedLogs = [...logs].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    return sortedLogs.map(log => ({
        date: log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit' }) ?? 'N/A',
        timestampValue: log.timestamp?.toMillis(),
        mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters),
        cost: log.cost > 0 ? log.cost : null,
        fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters)
    }));
   }, [logs]);

  // --- Copy Table Data Function ---
  const copyTableData = async () => {
    // ... (copyTableData function remains the same as in history_page_copy_tsx) ...
    if (!logs || logs.length === 0) { setCopyStatus('No data'); setTimeout(() => setCopyStatus('Copy Table Data'), 2000); return; }
    if (!navigator.clipboard) { setCopyStatus('Clipboard unavailable'); setTimeout(() => setCopyStatus('Copy Table Data'), 3000); console.error('Clipboard API not available.'); return; }
    setCopyStatus('Copying...');
    const headers = ["Date", "Brand", "Cost (€)", "Distance (Km)", "Fuel (L)", "km/L", "L/100km", "MPG (UK)", "Cost/Mile"].join('\t');
    const dataRows = logs.map(log => {
        const dateStr = log.timestamp?.toDate().toLocaleDateString('en-IE') ?? ''; const brandStr = log.brand?.replace(/\t|\n|\r/g, ' ') ?? '';
        const costStr = log.cost?.toFixed(2) ?? ''; const distanceKmStr = log.distanceKm?.toFixed(1) ?? ''; const fuelLitersStr = log.fuelAmountLiters?.toFixed(2) ?? '';
        const kmLStr = formatKmL(log.distanceKm, log.fuelAmountLiters); const l100kmStr = formatL100km(log.distanceKm, log.fuelAmountLiters);
        const mpgStr = formatMPG(log.distanceKm, log.fuelAmountLiters); const costPerMileStr = formatCostPerMile(log.cost, log.distanceKm).replace('€','');
        return [dateStr, brandStr, costStr, distanceKmStr, fuelLitersStr, kmLStr, l100kmStr, mpgStr, costPerMileStr].join('\t'); });
    const tsvString = [headers, ...dataRows].join('\n');
    try { await navigator.clipboard.writeText(tsvString); setCopyStatus('Copied!'); } catch (err) { console.error('Failed to copy data to clipboard:', err); setCopyStatus('Copy Failed!'); } finally { setTimeout(() => setCopyStatus('Copy Table Data'), 2000); }
  };


  // --- Render Logic ---
  // NOTE: Loading/Error states are handled *within* the Table Section below now
  // if (isLoading) { /* ... loading indicator ... */ } // Handled below
  // if (error) { /* ... error message ... */ } // Handled below

  return (
    <div className="space-y-8">
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Fuel History & Trends</h2>

      {/* Charts Section */}
      {logs.length > 1 && !isLoading && !error ? ( // Check logs, loading and error state before rendering chart
        <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
           <h3 className="text-lg font-medium text-gray-700 mb-4">MPG (UK) Over Time</h3>
           <ResponsiveContainer width="100%" height={300}>
             <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} label={{ value: 'MPG (UK)', angle: -90, position: 'insideLeft', offset: 10, style: {fontSize: '12px', fill: '#666'} }}/>
                <Tooltip contentStyle={{ fontSize: '12px', padding: '5px' }} formatter={(value: number) => value?.toFixed(2)} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="mpg" name="MPG (UK)" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} connectNulls />
             </LineChart>
           </ResponsiveContainer>
        </div>
      ) : (
         // Show message if not loading, no error, but not enough data for chart
        !isLoading && !error && logs.length <= 1 && <div className="text-center text-gray-500 text-sm p-4">Need at least two logs to show trends.</div>
      )}

      {/* --- Table Section --- */}
      <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
        {/* Section Header with Copy Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2 sm:mb-0">Log Details</h3>
            <button
                onClick={copyTableData}
                disabled={copyStatus !== 'Copy Table Data'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    copyStatus === 'Copied!' ? 'bg-green-100 text-green-700' :
                    copyStatus === 'Copy Failed!' || copyStatus === 'Clipboard unavailable' ? 'bg-red-100 text-red-700 cursor-not-allowed' :
                    copyStatus === 'Copying...' || copyStatus === 'No data' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' :
                    'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
            >
                {copyStatus}
            </button>
        </div>

        {/* Table and Loading/Error/Empty States */}
        {/* REMOVED the problematic line that was here previously */}
        {logs.length > 0 && !isLoading && !error && ( // Only show table if logs exist and not loading/error
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                 <thead className="bg-gray-50"><tr><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (€)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (Km)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">km/L</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">L/100km</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MPG (UK)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Mile</th></tr></thead>
                 <tbody className="bg-white divide-y divide-gray-200">{logs.map((log) => (<tr key={log.id} className="hover:bg-gray-50 transition duration-150 ease-in-out"><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{log.brand}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.cost?.toFixed(2)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.distanceKm?.toFixed(1)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.fuelAmountLiters?.toFixed(2)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatKmL(log.distanceKm, log.fuelAmountLiters)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatL100km(log.distanceKm, log.fuelAmountLiters)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatMPG(log.distanceKm, log.fuelAmountLiters)}</td><td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatCostPerMile(log.cost, log.distanceKm)}</td></tr>))}</tbody>
                </table>
            </div>
        )}
        {/* Centralized Loading/Error/Empty states */}
        {isLoading && <div className="text-center py-10"><p className="text-gray-500 animate-pulse">Loading fuel history...</p></div>}
        {error && <div className="text-center py-10 px-4"><p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p></div>}
        {!isLoading && !error && logs.length === 0 && <div className="text-center py-10"><p className="text-gray-600">No fuel logs found. Add your first entry!</p></div>}
      </div>
    </div>
  );
}

export default HistoryPage;

// src/pages/HistoryPage.tsx
import {JSX, useState, useEffect, useMemo, ChangeEvent, FormEvent } from 'react';
// Import Firestore functions for reading, updating, and deleting documents
import {
    collection, query, where, orderBy, onSnapshot, Timestamp,
    doc, deleteDoc, updateDoc, DocumentData, QuerySnapshot // Added missing types
} from "firebase/firestore";
// Import Firebase config and Auth hook
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
// Import Recharts components for charting
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- Interfaces ---

// Defines the structure of the raw data stored in Firestore for each fuel log
interface FuelLogData {
  userId: string; // ID of the user who created the log
  timestamp: Timestamp; // Firestore Timestamp of when the log was created/filled
  brand: string; // Name of the filling station/garage
  cost: number; // Total cost of the fuel purchase (e.g., in Euros)
  distanceKm: number; // Distance driven since the last fill-up, in Kilometers
  fuelAmountLiters: number; // Amount of fuel added, in Litres
  // Optional location fields captured during logging
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
}

// Extends the raw data structure to include the unique Firestore document ID
interface Log extends FuelLogData {
  id: string; // Firestore document ID, used as key and for updates/deletes
}

// Defines the structure of data points prepared specifically for the Recharts library
interface ChartDataPoint {
    date: string; // Formatted date string (e.g., "DD/MM") used for XAxis labels
    timestampValue: number; // Original timestamp milliseconds, useful for sorting or tooltips
    mpg: number | null; // Calculated MPG (UK), null if calculation is not possible
    cost: number | null; // Total cost, null if not valid
    fuelPrice: number | null; // Calculated price per litre (€/L), null if not possible
}

// Type for the state holding the specific log currently being edited in the modal
type EditingLogState = Log | null; // Can be a Log object or null if no log is being edited

// Type for the state managing the input values within the Edit modal form
interface EditFormData {
    brand: string;
    cost: string; // Stored as string to match input field value
    distanceKm: string; // Stored as string
    fuelAmountLiters: string; // Stored as string
}

// --- Conversion Factors ---
const LITRES_TO_UK_GALLONS = 4.54609; // Conversion factor from Litres to UK Imperial Gallons
const KM_TO_MILES = 1 / 1.60934; // Conversion factor from Kilometers to Miles

// --- React Component ---
function HistoryPage(): JSX.Element {
  // Get the current authenticated user from context
  const { user } = useAuth();

  // --- Component State ---
  const [logs, setLogs] = useState<Log[]>([]); // Holds the array of fetched fuel logs
  const [isLoading, setIsLoading] = useState<boolean>(true); // Tracks if logs are currently being fetched
  const [error, setError] = useState<string | null>(null); // Stores any error message during data fetching
  const [copyStatus, setCopyStatus] = useState<string>('Copy Table Data'); // Manages the text/state of the copy button

  // --- State specifically for the Edit Modal ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // Controls visibility of the edit modal
  const [editingLog, setEditingLog] = useState<EditingLogState>(null); // Stores the full log object being edited
  const [editFormData, setEditFormData] = useState<EditFormData>({ brand: '', cost: '', distanceKm: '', fuelAmountLiters: '' }); // Holds the current values in the edit form inputs
  const [isUpdating, setIsUpdating] = useState<boolean>(false); // Tracks if an update operation is in progress
  const [modalError, setModalError] = useState<string | null>(null); // Stores error messages specific to the edit modal form

  // --- Firestore Listener Effect ---
  // This effect runs when the component mounts and whenever the 'user' object changes.
  // It sets up a real-time listener for the user's fuel logs in Firestore.
  useEffect(() => {
    // If there's no logged-in user, stop loading and don't attempt to fetch data.
    if (!user) {
      setIsLoading(false);
      setLogs([]); // Clear any existing logs if user logs out
      return;
    };

    setIsLoading(true); // Set loading state to true before starting the fetch
    setError(null); // Clear any previous errors

    // Define the Firestore query:
    const q = query(
      collection(db, "fuelLogs"), // Target the 'fuelLogs' collection
      where("userId", "==", user.uid), // Filter documents where 'userId' matches the current user's ID
      orderBy("timestamp", "desc") // Order the results by timestamp, newest first (for the table)
    );

    // Use onSnapshot to listen for real-time updates to the query results.
    // This means the UI will update automatically if data changes in Firestore.
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const logsData: Log[] = [];
      // Loop through each document snapshot in the results
      querySnapshot.forEach((doc) => {
        // Combine the document ID with the document data (cast to FuelLogData)
        logsData.push({ id: doc.id, ...(doc.data() as FuelLogData) });
      });
      setLogs(logsData); // Update the component's state with the fetched logs
      setIsLoading(false); // Set loading state to false now that data is fetched/updated
    }, (err) => {
      // This function runs if there's an error fetching data from Firestore
      console.error("Error fetching fuel logs:", err);
      setError("Failed to load fuel history. Please try again later."); // Set user-friendly error message
      setIsLoading(false); // Set loading false even if there was an error
    });

    // Cleanup function: This is returned by useEffect and runs when the component
    // unmounts or before the effect runs again (due to 'user' changing).
    // It unsubscribes from the Firestore listener to prevent memory leaks.
    return () => {
      console.log("Unsubscribing from fuel logs listener");
      unsubscribe();
    };
  }, [user]); // The effect depends on the 'user' object. It re-runs if 'user' changes.

  // --- Calculation Functions for Display (returning formatted strings) ---

  /** Calculates MPG (UK) from Kilometers and Litres, returns formatted string or 'N/A'/'Error'. */
  const formatMPG = (distanceKm: number, fuelAmountLiters: number): string => {
    if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
    try {
      const distanceMiles = distanceKm * KM_TO_MILES;
      const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS;
      const mpg = distanceMiles / gallonsUK;
      return mpg.toFixed(2); // Format to 2 decimal places
    } catch { return 'Error'; }
  };

  /** Calculates Cost per Mile from Euro cost and Kilometers, returns formatted string or 'N/A'/'Error'. */
  const formatCostPerMile = (cost: number, distanceKm: number): string => {
    if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A';
    try {
      const distanceMiles = distanceKm * KM_TO_MILES;
      const costPerMile = cost / distanceMiles;
      return `€${costPerMile.toFixed(3)}`; // Format as currency with 3 decimal places
    } catch { return 'Error'; }
  };

  /** Calculates Kilometers per Litre, returns formatted string or 'N/A'/'Error'. */
  const formatKmL = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try {
          const kml = distanceKm / fuelAmountLiters;
          return kml.toFixed(2); // Format to 2 decimal places
      } catch { return 'Error'; }
  };

  /** Calculates Litres per 100 Kilometers, returns formatted string or 'N/A'/'Error'. */
  const formatL100km = (distanceKm: number, fuelAmountLiters: number): string => {
      if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A';
      try {
          const l100km = (fuelAmountLiters / distanceKm) * 100;
          return l100km.toFixed(2); // Format to 2 decimal places
      } catch { return 'Error'; }
  };

  // --- Calculation Functions for Charts (returning number or null) ---

  /** Calculates MPG (UK) from Kilometers and Litres, returns number or null. */
  const getNumericMPG = (distanceKm: number, fuelAmountLiters: number): number | null => {
    if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
    try {
        const distanceMiles = distanceKm * KM_TO_MILES;
        const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS;
        return distanceMiles / gallonsUK;
    } catch { return null; }
  };

  /** Calculates Fuel Price (€/L) from Cost and Litres, returns number or null. */
  const getNumericFuelPrice = (cost: number, fuelAmountLiters: number): number | null => {
      if (!cost || cost <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
      try { return cost / fuelAmountLiters; } catch { return null; }
  };

  // --- Prepare Data for Charts using useMemo ---
  // useMemo ensures this complex calculation only runs when the 'logs' state changes.
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!logs || logs.length === 0) return []; // Return empty array if no logs

    // Create a copy and sort logs ascending by date for time-series charts
    // The Firestore query returns descending, so we reverse for the chart.
    const sortedLogs = [...logs].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

    // Map the sorted logs to the structure needed by Recharts
    return sortedLogs.map(log => ({
        // Format date for X-axis label (e.g., '09/04' for Ireland locale)
        date: log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit' }) ?? 'N/A',
        timestampValue: log.timestamp?.toMillis(), // Keep original timestamp if needed elsewhere
        mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters), // Use numeric calculation
        cost: log.cost > 0 ? log.cost : null, // Use cost directly, null if invalid
        fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters) // Use numeric calculation
    }));
  }, [logs]); // Dependency array: Recalculate only when 'logs' changes.

  // --- Copy Table Data Function ---
  // Creates a TSV string of the table data and copies it to the clipboard.
  const copyTableData = async () => {
    if (!logs || logs.length === 0) { setCopyStatus('No data'); setTimeout(() => setCopyStatus('Copy Table Data'), 2000); return; }
    // Check if Clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        setCopyStatus('Clipboard unavailable'); setTimeout(() => setCopyStatus('Copy Table Data'), 3000); console.error('Clipboard API not available.'); return;
    }

    setCopyStatus('Copying...'); // Update button text

    // Define headers using Tab ('\t') as separator
    const headers = [ "Date", "Brand", "Cost (€)", "Distance (Km)", "Fuel (L)", "km/L", "L/100km", "MPG (UK)", "Cost/Mile" ].join('\t');

    // Map log data to TSV rows, using formatting functions
    const dataRows = logs.map(log => {
        const dateStr = log.timestamp?.toDate().toLocaleDateString('en-IE') ?? '';
        const brandStr = log.brand?.replace(/\t|\n|\r/g, ' ') ?? ''; // Sanitize brand name
        const costStr = log.cost?.toFixed(2) ?? '';
        const distanceKmStr = log.distanceKm?.toFixed(1) ?? '';
        const fuelLitersStr = log.fuelAmountLiters?.toFixed(2) ?? '';
        const kmLStr = formatKmL(log.distanceKm, log.fuelAmountLiters);
        const l100kmStr = formatL100km(log.distanceKm, log.fuelAmountLiters);
        const mpgStr = formatMPG(log.distanceKm, log.fuelAmountLiters);
        // Remove currency symbol for easier pasting into spreadsheets
        const costPerMileStr = formatCostPerMile(log.cost, log.distanceKm).replace('€','');

        return [ dateStr, brandStr, costStr, distanceKmStr, fuelLitersStr, kmLStr, l100kmStr, mpgStr, costPerMileStr ].join('\t'); // Join values with Tab
    });

    // Combine header and rows using Newline ('\n')
    const tsvString = [headers, ...dataRows].join('\n');

    try {
        // Use Clipboard API to write the text
        await navigator.clipboard.writeText(tsvString);
        setCopyStatus('Copied!'); // Update button on success
    } catch (err) {
        console.error('Failed to copy data to clipboard:', err);
        setCopyStatus('Copy Failed!'); // Update button on error
    } finally {
        // Reset button text after 2 seconds regardless of success/failure
        setTimeout(() => setCopyStatus('Copy Table Data'), 2000);
    }
  };

  // --- Delete Function ---
  // Handles deleting a specific log entry by its Firestore ID.
  const handleDeleteLog = async (logId: string) => {
    if (!logId) return; // Do nothing if ID is invalid

    // Use browser's confirm dialog for safety
    if (window.confirm("Are you sure you want to delete this log entry? This action cannot be undone.")) {
      try {
        // Create a reference to the specific Firestore document
        const logRef = doc(db, "fuelLogs", logId);
        // Delete the document
        await deleteDoc(logRef);
        // No need to manually update state - onSnapshot listener will detect the change
        console.log(`Log ${logId} deleted successfully.`);
        // Optional: Show a temporary success message using a toast notification library
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Failed to delete log entry. Please try again."); // Use alert for simple error feedback
      }
    }
  };

  // --- Edit Modal Functions ---

  /** Opens the edit modal and pre-populates the form with the selected log's data. */
  const handleOpenEditModal = (log: Log) => {
    setEditingLog(log); // Store the log being edited
    // Set the form state using the data from the selected log
    setEditFormData({
        brand: log.brand || '',
        cost: log.cost?.toString() || '', // Convert numbers to strings for input fields
        distanceKm: log.distanceKm?.toString() || '',
        fuelAmountLiters: log.fuelAmountLiters?.toString() || ''
    });
    setModalError(null); // Clear any previous errors shown in the modal
    setIsModalOpen(true); // Set state to show the modal
  };

  /** Closes the edit modal and resets related state variables. */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLog(null); // Clear the log being edited
    setEditFormData({ brand: '', cost: '', distanceKm: '', fuelAmountLiters: '' }); // Reset form fields
    setModalError(null); // Clear modal errors
    setIsUpdating(false); // Ensure updating state is reset
  };

  /** Updates the edit form state as the user types in the modal inputs. */
  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Update the corresponding field in the editFormData state
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Handles the submission of the edit form within the modal. */
  const handleUpdateLog = async (e: FormEvent<HTMLFormElement>) => {
     e.preventDefault(); // Prevent default form submission behavior
     if (!editingLog) return; // Should not happen if modal is open correctly, but good check

     // --- Validation for Edit Form ---
     const { brand, cost, distanceKm, fuelAmountLiters } = editFormData;
     // Check for empty required fields
     if (!cost || !distanceKm || !fuelAmountLiters) {
         setModalError('Cost, Distance, and Fuel Amount cannot be empty.');
         return;
     }
     // Parse string inputs back to numbers
     const parsedCost = parseFloat(cost);
     const parsedDistanceKm = parseFloat(distanceKm);
     const parsedFuel = parseFloat(fuelAmountLiters);
     // Validate that parsing was successful and values are positive
     if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) {
         setModalError('Cost, Distance (Km), and Fuel Amount must be valid positive numbers.');
         return;
     }
     // --- End Validation ---

     setIsUpdating(true); // Set state to indicate update is in progress (e.g., disable buttons)
     setModalError(null); // Clear previous modal errors

     try {
        // Create a reference to the specific Firestore document being edited
        const logRef = doc(db, "fuelLogs", editingLog.id);
        // Prepare the data object with only the fields that can be updated
        const updatedData = {
            brand: brand.trim() || 'Unknown', // Trim whitespace or use 'Unknown'
            cost: parsedCost,
            distanceKm: parsedDistanceKm,
            fuelAmountLiters: parsedFuel,
            // NOTE: We are NOT updating timestamp, userId, or location fields here.
            // updateDoc only modifies the fields specified in the object.
        };
        // Perform the update operation in Firestore
        await updateDoc(logRef, updatedData);
        console.log(`Log ${editingLog.id} updated successfully.`);
        handleCloseModal(); // Close the modal automatically on successful update
        // Optional: Show a success toast notification
     } catch (error) {
        console.error("Error updating document: ", error);
        setModalError("Failed to update log. Please try again."); // Show error within the modal
     } finally {
        setIsUpdating(false); // Reset updating state whether success or error
     }
  };


  // --- Render Logic ---

  return (
    // Main container with vertical spacing between sections
    <div className="space-y-8">
      {/* Page Title */}
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Fuel History & Trends</h2>

      {/* --- Charts Section --- */}
      {/* Conditionally render chart only if not loading, no error, and enough data exists */}
      {logs.length > 1 && !isLoading && !error ? (
        <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
           <h3 className="text-lg font-medium text-gray-700 mb-4">MPG (UK) Over Time</h3>
           {/* Responsive container ensures chart fits its parent */}
           <ResponsiveContainer width="100%" height={300}>
             <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                {/* Grid lines */}
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                {/* X-axis displaying formatted date */}
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                {/* Y-axis with label */}
                <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} label={{ value: 'MPG (UK)', angle: -90, position: 'insideLeft', offset: 10, style: {fontSize: '12px', fill: '#666'} }}/>
                {/* Tooltip shown on hover */}
                <Tooltip contentStyle={{ fontSize: '12px', padding: '5px' }} formatter={(value: number) => value?.toFixed(2)} />
                {/* Legend to identify lines */}
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {/* Line representing MPG data */}
                <Line type="monotone" dataKey="mpg" name="MPG (UK)" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} connectNulls />
             </LineChart>
           </ResponsiveContainer>
           {/* Add more charts here if desired */}
        </div>
      ) : (
         // Show message if chart isn't rendered due to insufficient data (and not loading/error)
        !isLoading && !error && logs.length <= 1 && <div className="text-center text-gray-500 text-sm p-4">Need at least two logs to show trends.</div>
      )}

      {/* --- Table Section --- */}
      <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
        {/* Section Header with Title and Copy Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2 sm:mb-0">Log Details</h3>
            {/* Copy Button - appearance changes based on copyStatus state */}
            <button
                onClick={copyTableData}
                disabled={copyStatus !== 'Copy Table Data'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    copyStatus === 'Copied!' ? 'bg-green-100 text-green-700' :
                    copyStatus === 'Copy Failed!' || copyStatus === 'Clipboard unavailable' ? 'bg-red-100 text-red-700 cursor-not-allowed' :
                    copyStatus === 'Copying...' || copyStatus === 'No data' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' :
                    'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' // Default state
                }`}
            >
                {copyStatus}
            </button>
        </div>

        {/* Conditional Rendering for Table vs States */}
        {/* Show table only if NOT loading, NO error, and logs EXIST */}
        {logs.length > 0 && !isLoading && !error && (
            <div className="overflow-x-auto"> {/* Allows horizontal scrolling on small screens */}
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                 <thead className="bg-gray-50">
                    {/* Table Headers including Actions */}
                    <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (€)</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (Km)</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">km/L</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">L/100km</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MPG (UK)</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Mile</th>
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                    {/* Map over logs array to generate table rows */}
                    {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                        {/* Data Cells - using formatting functions */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{log.brand}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.cost?.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.distanceKm?.toFixed(1)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.fuelAmountLiters?.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatKmL(log.distanceKm, log.fuelAmountLiters)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatL100km(log.distanceKm, log.fuelAmountLiters)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatMPG(log.distanceKm, log.fuelAmountLiters)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatCostPerMile(log.cost, log.distanceKm)}</td>
                        {/* Actions Cell with Edit and Delete Buttons */}
                        <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                            <button onClick={() => handleOpenEditModal(log)} className="text-indigo-600 hover:text-indigo-900 transition duration-150 ease-in-out" title="Edit Log">Edit</button>
                            <button onClick={() => handleDeleteLog(log.id)} className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out" title="Delete Log">Delete</button>
                        </td>
                    </tr>
                    ))}
                 </tbody>
                </table>
            </div>
        )}
        {/* Loading State Indicator */}
        {isLoading && <div className="text-center py-10"><p className="text-gray-500 animate-pulse">Loading fuel history...</p></div>}
        {/* Error Message Display */}
        {error && <div className="text-center py-10 px-4"><p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p></div>}
        {/* Empty State Message (only shown if not loading and no error) */}
        {!isLoading && !error && logs.length === 0 && <div className="text-center py-10"><p className="text-gray-600">No fuel logs found. Add your first entry!</p></div>}
      </div>

       {/* --- Edit Modal --- */}
       {/* Conditionally render the modal based on isModalOpen state */}
       {isModalOpen && editingLog && (
         <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity flex items-center justify-center" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Modal Content Container */}
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4 space-y-4 transform transition-all">
                {/* Modal Title */}
                <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                    Edit Log Entry ({editingLog.timestamp.toDate().toLocaleDateString('en-IE')})
                </h3>
                {/* Edit Form */}
                <form onSubmit={handleUpdateLog} className="space-y-4">
                    {/* Brand Input */}
                    <div>
                        <label htmlFor="edit-brand" className="block text-sm font-medium text-gray-700">Brand</label>
                        <input type="text" name="brand" id="edit-brand" value={editFormData.brand} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                    </div>
                    {/* Cost Input */}
                    <div>
                        <label htmlFor="edit-cost" className="block text-sm font-medium text-gray-700">Cost (€)</label>
                        <input type="number" inputMode="decimal" name="cost" id="edit-cost" value={editFormData.cost} onChange={handleEditFormChange} step="0.01" min="0.01" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                    </div>
                    {/* Distance Input */}
                    <div>
                        <label htmlFor="edit-distanceKm" className="block text-sm font-medium text-gray-700">Distance (Km)</label>
                        <input type="number" inputMode="decimal" name="distanceKm" id="edit-distanceKm" value={editFormData.distanceKm} onChange={handleEditFormChange} step="0.1" min="0.1" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                    </div>
                    {/* Fuel Input */}
                    <div>
                        <label htmlFor="edit-fuelAmountLiters" className="block text-sm font-medium text-gray-700">Fuel (L)</label>
                        <input type="number" inputMode="decimal" name="fuelAmountLiters" id="edit-fuelAmountLiters" value={editFormData.fuelAmountLiters} onChange={handleEditFormChange} step="0.01" min="0.01" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                    </div>

                    {/* Modal Error Message Display */}
                    {modalError && <p className="text-sm text-red-600">{modalError}</p>}

                    {/* Modal Action Buttons */}
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button type="submit" disabled={isUpdating} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50">
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" onClick={handleCloseModal} disabled={isUpdating} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
         </div>
       )}
       {/* --- End Edit Modal --- */}

    </div> // End main page container
  );
}

// NOTE: Calculation function implementations were added back below for completeness.
// Ensure these are correctly defined in your actual file.
const formatMPG = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; const mpg = distanceMiles / gallonsUK; return mpg.toFixed(2); } catch { return 'Error'; } };
const formatCostPerMile = (cost: number, distanceKm: number): string => { if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const costPerMile = cost / distanceMiles; return `€${costPerMile.toFixed(3)}`; } catch { return 'Error'; } };
const formatKmL = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const kml = distanceKm / fuelAmountLiters; return kml.toFixed(2); } catch { return 'Error'; } };
const formatL100km = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const l100km = (fuelAmountLiters / distanceKm) * 100; return l100km.toFixed(2); } catch { return 'Error'; } };
const getNumericMPG = (distanceKm: number, fuelAmountLiters: number): number | null => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null; try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; return distanceMiles / gallonsUK; } catch { return null; } };
const getNumericFuelPrice = (cost: number, fuelAmountLiters: number): number | null => { if (!cost || cost <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null; try { return cost / fuelAmountLiters; } catch { return null; } };


export default HistoryPage;

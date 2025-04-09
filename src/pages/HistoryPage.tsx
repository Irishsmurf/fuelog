// src/pages/HistoryPage.tsx
import { JSX, useState, useEffect, useMemo, ChangeEvent, FormEvent } from 'react';
// Import Firestore functions for reading, updating, and deleting documents
import {
    collection, query, where, orderBy, onSnapshot,
    doc, deleteDoc, updateDoc, DocumentData, QuerySnapshot // Ensure getDocs is imported if used elsewhere, though onSnapshot is primary here
} from "firebase/firestore";
// Import Firebase config and Auth hook
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
// Import Recharts components for charting
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
// Import the LogCard component
import LogCard from '../components/LogCard'; // Adjust path if necessary
import { ChartDataPoint, FuelLogData, Log, EditFormData, EditingLogState, ViewMode } from '../utils/types';
import { formatCostPerMile, formatKmL, formatL100km, formatMPG, getNumericFuelPrice, getNumericMPG } from '../utils/calculations';

// --- React Component ---
function HistoryPage(): JSX.Element {
  // Get the current authenticated user from context
  const { user } = useAuth();

  // --- Component State ---
  const [logs, setLogs] = useState<Log[]>([]); // Holds the array of ALL fetched fuel logs for the user
  const [isLoading, setIsLoading] = useState<boolean>(true); // Tracks if logs are currently being fetched
  const [error, setError] = useState<string | null>(null); // Stores any error message during data fetching
  const [copyStatus, setCopyStatus] = useState<string>('Copy Table Data'); // Manages the text/state of the copy button

  // --- State for Edit Modal ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // Controls visibility of the edit modal
  const [editingLog, setEditingLog] = useState<EditingLogState>(null); // Stores the full log object being edited
  const [editFormData, setEditFormData] = useState<EditFormData>({ brand: '', cost: '', distanceKm: '', fuelAmountLiters: '' }); // Holds the current values in the edit form inputs
  const [isUpdating, setIsUpdating] = useState<boolean>(false); // Tracks if an update operation is in progress
  const [modalError, setModalError] = useState<string | null>(null); // Stores error messages specific to the edit modal form

  // --- State for Filtering ---
  const [filterStartDate, setFilterStartDate] = useState<string>(''); // Format: YYYY-MM-DD
  const [filterEndDate, setFilterEndDate] = useState<string>('');     // Format: YYYY-MM-DD
  const [filterBrand, setFilterBrand] = useState<string>('');       // Selected brand or '' for all
  const [uniqueBrands, setUniqueBrands] = useState<string[]>([]);    // List of unique brands for the filter dropdown

  // --- State for View Toggle ---
  const [viewMode, setViewMode] = useState<ViewMode>('table'); // Default to table view

  // --- Firestore Listener Effect ---
  // Fetches all logs for the user and listens for real-time updates.
  // Also extracts unique brands for the filter dropdown.
  useEffect(() => {
    if (!user) { setIsLoading(false); setLogs([]); setUniqueBrands([]); return; }; // Reset if user logs out
    setIsLoading(true); setError(null);

    const q = query(collection(db, "fuelLogs"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const logsData: Log[] = [];
      const brands = new Set<string>(); // Use Set for efficient uniqueness check

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FuelLogData;
        logsData.push({ id: doc.id, ...data });
        // Add brand to set if it exists and is not 'Unknown'
        if (data.brand && data.brand.toLowerCase() !== 'unknown') {
          brands.add(data.brand.trim());
        }
      });

      setLogs(logsData); // Update the main logs state
      // Update the unique brands list for the filter dropdown
      setUniqueBrands(Array.from(brands).sort((a, b) => a.localeCompare(b)));
      setIsLoading(false); // Loading complete
    }, (err) => {
      // Handle Firestore errors
      console.error("Error fetching fuel logs:", err);
      setError("Failed to load fuel history. Please check your connection and try again.");
      setIsLoading(false);
    });

    // Cleanup listener on unmount or user change
    return () => unsubscribe();
  }, [user]); // Dependency array ensures effect runs when user changes

  // --- Filtering Logic using useMemo ---
  // Creates a memoized array of logs based on the current filter state.
  // This avoids re-filtering on every render unless logs or filters change.
  const filteredLogs = useMemo(() => {
    let tempLogs = [...logs]; // Start with a copy of all fetched logs

    // Filter by Start Date
    if (filterStartDate) {
      try {
        const startDate = new Date(filterStartDate);
        startDate.setHours(0, 0, 0, 0); // Compare from the beginning of the day
        tempLogs = tempLogs.filter(log => log.timestamp.toDate() >= startDate);
      } catch (e) { console.error("Error parsing start date for filtering:", e); }
    }

    // Filter by End Date
    if (filterEndDate) {
      try {
        const endDate = new Date(filterEndDate);
        endDate.setHours(23, 59, 59, 999); // Compare until the end of the day
        tempLogs = tempLogs.filter(log => log.timestamp.toDate() <= endDate);
      } catch (e) { console.error("Error parsing end date for filtering:", e); }
    }

    // Filter by Brand
    if (filterBrand) { // Only filter if a brand is selected (not '')
      tempLogs = tempLogs.filter(log => log.brand === filterBrand);
    }

    return tempLogs; // Return the filtered array
  }, [logs, filterStartDate, filterEndDate, filterBrand]); // Dependencies for recalculation

  // --- Prepare Chart Data (Uses filteredLogs) ---
  // Memoized calculation for chart data based on the *filtered* logs.
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!filteredLogs || filteredLogs.length === 0) return [];
    // Sort ascending by date for time-series charts
    const sortedLogs = [...filteredLogs].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    return sortedLogs.map(log => ({
        date: log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit' }) ?? 'N/A',
        timestampValue: log.timestamp?.toMillis(),
        mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters),
        cost: log.cost > 0 ? log.cost : null,
        fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters)
    }));
  }, [filteredLogs]); // Recalculate only when filteredLogs change

  // --- Copy Table Data Function (Uses filteredLogs) ---
  // Formats the *currently filtered* logs as TSV and copies to clipboard.
  const copyTableData = async () => {
      if (!filteredLogs || filteredLogs.length === 0) { setCopyStatus('No data'); setTimeout(() => setCopyStatus('Copy Table Data'), 2000); return; }
      if (!navigator.clipboard || !navigator.clipboard.writeText) { setCopyStatus('Clipboard unavailable'); setTimeout(() => setCopyStatus('Copy Table Data'), 3000); console.error('Clipboard API not available.'); return; }
      setCopyStatus('Copying...');
      const headers = [ "Date", "Brand", "Cost (€)", "Distance (Km)", "Fuel (L)", "km/L", "L/100km", "MPG (UK)", "Cost/Mile" ].join('\t');
      const dataRows = filteredLogs.map(log => { // Use filteredLogs here
          const dateStr = log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit' }) ?? ''; const brandStr = log.brand?.replace(/\t|\n|\r/g, ' ') ?? '';
          const costStr = log.cost?.toFixed(2) ?? ''; const distanceKmStr = log.distanceKm?.toFixed(1) ?? ''; const fuelLitersStr = log.fuelAmountLiters?.toFixed(2) ?? '';
          const kmLStr = formatKmL(log.distanceKm, log.fuelAmountLiters); const l100kmStr = formatL100km(log.distanceKm, log.fuelAmountLiters);
          const mpgStr = formatMPG(log.distanceKm, log.fuelAmountLiters); const costPerMileStr = formatCostPerMile(log.cost, log.distanceKm).replace('€','');
          return [ dateStr, brandStr, costStr, distanceKmStr, fuelLitersStr, kmLStr, l100kmStr, mpgStr, costPerMileStr ].join('\t');
      });
      const tsvString = [headers, ...dataRows].join('\n');
      try { await navigator.clipboard.writeText(tsvString); setCopyStatus('Copied!'); } catch (err) { console.error('Failed to copy data to clipboard:', err); setCopyStatus('Copy Failed!'); } finally { setTimeout(() => setCopyStatus('Copy Table Data'), 2000); }
  };

  // --- Delete Function ---
  // Handles deleting a specific log entry by its Firestore ID after confirmation.
  const handleDeleteLog = async (logId: string) => {
    if (!logId) return;
    if (window.confirm("Are you sure you want to delete this log entry? This action cannot be undone.")) {
      try {
        const logRef = doc(db, "fuelLogs", logId);
        await deleteDoc(logRef);
        console.log(`Log ${logId} deleted successfully.`);
        // UI updates via onSnapshot listener
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Failed to delete log entry. Please try again.");
      }
    }
  };

  // --- Edit Modal Functions ---

  /** Opens the edit modal and pre-populates the form. */
  const handleOpenEditModal = (log: Log) => {
    setEditingLog(log);
    setEditFormData({
        brand: log.brand || '', cost: log.cost?.toString() || '',
        distanceKm: log.distanceKm?.toString() || '', fuelAmountLiters: log.fuelAmountLiters?.toString() || ''
    });
    setModalError(null); setIsModalOpen(true);
  };

  /** Closes the edit modal and resets state. */
  const handleCloseModal = () => {
    setIsModalOpen(false); setEditingLog(null);
    setEditFormData({ brand: '', cost: '', distanceKm: '', fuelAmountLiters: '' });
    setModalError(null); setIsUpdating(false);
  };

  /** Updates edit form state on input change. */
  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Handles submission of the edit form, validates, and updates Firestore. */
  const handleUpdateLog = async (e: FormEvent<HTMLFormElement>) => {
     e.preventDefault(); if (!editingLog) return;
     const { brand, cost, distanceKm, fuelAmountLiters } = editFormData;
     if (!cost || !distanceKm || !fuelAmountLiters) { setModalError('Cost, Distance, and Fuel Amount cannot be empty.'); return; }
     const parsedCost = parseFloat(cost); const parsedDistanceKm = parseFloat(distanceKm); const parsedFuel = parseFloat(fuelAmountLiters);
     if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) { setModalError('Cost, Distance (Km), and Fuel Amount must be valid positive numbers.'); return; }

     setIsUpdating(true); setModalError(null);
     try {
        const logRef = doc(db, "fuelLogs", editingLog.id);
        const updatedData = { brand: brand.trim() || 'Unknown', cost: parsedCost, distanceKm: parsedDistanceKm, fuelAmountLiters: parsedFuel };
        await updateDoc(logRef, updatedData);
        console.log(`Log ${editingLog.id} updated successfully.`);
        handleCloseModal(); // Close modal on success
     } catch (error) { console.error("Error updating document: ", error); setModalError("Failed to update log. Please try again."); }
     finally { setIsUpdating(false); }
  };


  // --- Render Logic ---
  return (
    <div className="space-y-8"> {/* Vertical spacing between sections */}
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Fuel History & Trends</h2>

      {/* --- Filter Controls Section --- */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-md font-medium text-gray-700 mb-3">Filters</h3>
          {/* Grid layout for filter controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* Start Date Input */}
              <div>
                  <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" id="filterStartDate" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              {/* End Date Input */}
              <div>
                  <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" id="filterEndDate" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              {/* Brand Select Dropdown */}
              <div>
                  <label htmlFor="filterBrand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select id="filterBrand" value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white appearance-none"> {/* Added appearance-none */}
                      <option value="">All Brands</option>
                      {/* Populate options from uniqueBrands state */}
                      {uniqueBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                  </select>
              </div>
              {/* View Toggle Button */}
              <div className="flex justify-end">
                  <button
                      onClick={() => setViewMode(prev => prev === 'table' ? 'cards' : 'table')}
                      className="px-3 py-1.5 text-sm font-medium rounded-md shadow-sm transition duration-150 ease-in-out bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
                      title={`Switch to ${viewMode === 'table' ? 'Card' : 'Table'} View`}
                  >
                      {/* Display appropriate text based on current view mode */}
                      {viewMode === 'table' ? 'View Cards' : 'View Table'}
                  </button>
              </div>
          </div>
      </div>


      {/* --- Charts Section (Uses filtered data via chartData) --- */}
      {/* Render chart only if not loading, no error, and enough filtered data exists */}
      {filteredLogs.length > 1 && !isLoading && !error ? (
        <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
           <h3 className="text-lg font-medium text-gray-700 mb-4">MPG (UK) Over Time (Filtered)</h3>
           <ResponsiveContainer width="100%" height={300}>
             <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} label={{ value: 'MPG (UK)', angle: -90, position: 'insideLeft', offset: 10, style: {fontSize: '12px', fill: '#666'} }}/>
                <Tooltip contentStyle={{ fontSize: '12px', padding: '5px' }} formatter={(value: number) => value?.toFixed(2)} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="mpg" name="MPG (UK)" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} connectNulls />
             </LineChart>
           </ResponsiveContainer>
        </div>
      ) : (
         // Show message if chart isn't rendered due to insufficient filtered data
        !isLoading && !error && logs.length > 0 && filteredLogs.length <= 1 && <div className="text-center text-gray-500 text-sm p-4">Need at least two logs in the filtered range to show trends.</div>
      )}

      {/* --- Table / Cards Section --- */}
      <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200">
        {/* Section Header with Title (showing filtered count) and Copy Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2 sm:mb-0">
                Log Details {filteredLogs.length !== logs.length ? `(${filteredLogs.length} of ${logs.length} shown)` : `(${logs.length} total)`}
            </h3>
            <button onClick={copyTableData} disabled={copyStatus !== 'Copy Table Data' || filteredLogs.length === 0} className={`px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${copyStatus === 'Copied!' ? 'bg-green-100 text-green-700' : copyStatus === 'Copy Failed!' || copyStatus === 'Clipboard unavailable' ? 'bg-red-100 text-red-700 cursor-not-allowed' : copyStatus === 'Copying...' || copyStatus === 'No data' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>{copyStatus}</button>
        </div>

        {/* Centralized Loading/Error/Empty states */}
        {isLoading && <div className="text-center py-10"><p className="text-gray-500 animate-pulse">Loading fuel history...</p></div>}
        {error && <div className="text-center py-10 px-4"><p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p></div>}
        {!isLoading && !error && filteredLogs.length === 0 && <div className="text-center py-10"><p className="text-gray-600">{logs.length > 0 ? 'No logs match the current filters.' : 'No fuel logs found. Add your first entry!'}</p></div>}

        {/* Conditional Rendering based on viewMode - only render if not loading, no error, and filtered logs exist */}
        {!isLoading && !error && filteredLogs.length > 0 && (
            viewMode === 'table' ? (
                // --- Table View ---
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                    <thead className="bg-gray-50"><tr><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (€)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (Km)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">km/L</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">L/100km</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MPG (UK)</th><th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Mile</th><th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {/* Map over filteredLogs for table rows */}
                        {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{log.brand}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.cost?.toFixed(2)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.distanceKm?.toFixed(1)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{log.fuelAmountLiters?.toFixed(2)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatKmL(log.distanceKm, log.fuelAmountLiters)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatL100km(log.distanceKm, log.fuelAmountLiters)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatMPG(log.distanceKm, log.fuelAmountLiters)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatCostPerMile(log.cost, log.distanceKm)}</td>
                            {/* Actions Cell with Edit/Delete Buttons */}
                            <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                <button onClick={() => handleOpenEditModal(log)} className="text-indigo-600 hover:text-indigo-900 transition duration-150 ease-in-out" title="Edit Log">Edit</button>
                                <button onClick={() => handleDeleteLog(log.id)} className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out" title="Delete Log">Delete</button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            ) : (
                // --- Card View ---
                // Grid layout for cards, responsive columns
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Map over filteredLogs for card view */}
                    {filteredLogs.map((log) => (
                        <LogCard
                            key={log.id}
                            log={log}
                            onEdit={handleOpenEditModal} // Pass edit handler down
                            onDelete={handleDeleteLog}   // Pass delete handler down
                        />
                    ))}
                </div>
            )
        )}
      </div>

       {/* --- Edit Modal --- */}
       {/* Conditionally render the modal based on isModalOpen state */}
       {isModalOpen && editingLog && (
         <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity flex items-center justify-center" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4 space-y-4 transform transition-all">
                <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">Edit Log Entry ({editingLog.timestamp.toDate().toLocaleDateString('en-IE')})</h3>
                {/* Edit Form */}
                <form onSubmit={handleUpdateLog} className="space-y-4">
                    {/* Form Inputs (Brand, Cost, Distance, Fuel) */}
                    <div><label htmlFor="edit-brand" className="block text-sm font-medium text-gray-700">Brand</label><input type="text" name="brand" id="edit-brand" value={editFormData.brand} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
                    <div><label htmlFor="edit-cost" className="block text-sm font-medium text-gray-700">Cost (€)</label><input type="number" inputMode="decimal" name="cost" id="edit-cost" value={editFormData.cost} onChange={handleEditFormChange} step="0.01" min="0.01" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
                    <div><label htmlFor="edit-distanceKm" className="block text-sm font-medium text-gray-700">Distance (Km)</label><input type="number" inputMode="decimal" name="distanceKm" id="edit-distanceKm" value={editFormData.distanceKm} onChange={handleEditFormChange} step="0.1" min="0.1" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
                    <div><label htmlFor="edit-fuelAmountLiters" className="block text-sm font-medium text-gray-700">Fuel (L)</label><input type="number" inputMode="decimal" name="fuelAmountLiters" id="edit-fuelAmountLiters" value={editFormData.fuelAmountLiters} onChange={handleEditFormChange} step="0.01" min="0.01" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
                    {/* Modal Error Message */}
                    {modalError && <p className="text-sm text-red-600">{modalError}</p>}
                    {/* Modal Action Buttons */}
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button type="submit" disabled={isUpdating} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50">{isUpdating ? 'Saving...' : 'Save Changes'}</button>
                        <button type="button" onClick={handleCloseModal} disabled={isUpdating} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50">Cancel</button>
                    </div>
                </form>
            </div>
         </div>
       )}
       {/* --- End Edit Modal --- */}

    </div> // End main page container
  );
}

export default HistoryPage;

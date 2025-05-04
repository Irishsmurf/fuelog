// src/pages/HistoryPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config'; // Adjust path as needed
import { useAuth } from '../context/AuthContext'; // Assuming you have AuthContext
import { useVehicle } from '../context/VehicleContext'; // Import VehicleContext hook
import { Log, ViewMode, EditFormData, EditingLogState, ProcessedLog } from '../utils/types'; // Adjust path as needed
import { formatMPG, formatCostPerMile, formatKmL, getNumericMPG, getNumericFuelPrice } from '../utils/calculations'; // Adjust path as needed
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LayoutGrid, List, FileDown, Pencil, Trash2, X } from 'lucide-react'; // Example icons

// --- Helper Components (Define or Import these) ---

// Example Placeholder: Replace with your actual LogCard component
const LogCard: React.FC<{ log: ProcessedLog, onEdit: (log: ProcessedLog) => void, onDelete: (logId: string) => void }> = ({ log, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col justify-between">
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{log.timestamp.toDate().toLocaleDateString()}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{log.brand}</p>
            <p>Cost: €{log.cost.toFixed(2)}</p>
            <p>Litres: {log.fuelAmountLiters.toFixed(2)} L</p>
            <p>Distance: {log.distanceKm.toFixed(1)} km</p> {/* Now consistently populated */}
            {log.odometerKm && <p>Odometer: {log.odometerKm.toLocaleString()} km</p>}
            <p>km/L: {formatKmL(log.distanceKm, log.fuelAmountLiters)}</p>
            <p>MPG: {formatMPG(log.distanceKm, log.fuelAmountLiters)}</p>
            <p>Cost/Mile: {formatCostPerMile(log.cost, log.distanceKm)}</p>
        </div>
        <div className="flex justify-end space-x-2 mt-2">
            <button onClick={() => onEdit(log)} className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><Pencil size={16} /></button>
            <button onClick={() => onDelete(log.id)} className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><Trash2 size={16} /></button>
        </div>
    </div>
);

// Example Placeholder: Replace with your actual LogTable component
const LogTable: React.FC<{ logs: ProcessedLog[], onEdit: (log: ProcessedLog) => void, onDelete: (logId: string) => void }> = ({ logs, onEdit, onDelete }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Brand</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost (€)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Litres</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Distance (km)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Odometer (km)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">km/L</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">MPG (UK)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost/Mile (€)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                    <tr key={log.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.timestamp.toDate().toLocaleDateString()}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.brand}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.cost.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.fuelAmountLiters.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.distanceKm.toFixed(1)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.odometerKm?.toLocaleString() ?? 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatKmL(log.distanceKm, log.fuelAmountLiters)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatMPG(log.distanceKm, log.fuelAmountLiters)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatCostPerMile(log.cost, log.distanceKm)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                             <button onClick={() => onEdit(log)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"><Pencil size={16} /></button>
                             <button onClick={() => onDelete(log.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"><Trash2 size={16} /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// Example Placeholder: Replace with your actual EditLogModal component
const EditLogModal: React.FC<{
    log: EditingLogState;
    isOpen: boolean;
    onClose: () => void;
    onSave: (logId: string, data: Partial<EditFormData>) => Promise<boolean>; // Return true on success
}> = ({ log, isOpen, onClose, onSave }) => {
    // Internal state for form fields
    const [formData, setFormData] = useState<EditFormData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (log) {
            // Initialize form data when log changes
            setFormData({
                brand: log.brand || '',
                cost: log.cost?.toString() || '',
                fuelAmountLiters: log.fuelAmountLiters?.toString() || '',
                distanceKm: log.distanceKm?.toString() || '',
                odometerKm: log.odometerKm?.toString() || '',
                // Default or derive mileageInputMethod if not stored
                mileageInputMethod: log.mileageInputMethod || (log.odometerKm ? 'odometer' : 'distance'),
                vehicleId: log.vehicleId, // Include vehicleId
            });
            setSaveError(null); // Clear previous errors
        } else {
            setFormData(null); // Clear form if no log
        }
    }, [log]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!formData) return;
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!log || !formData) return;
        setIsSaving(true);
        setSaveError(null);

        // Prepare data for saving (parse numbers, etc.)
        // Add validation here!
        const updateData: Partial<EditFormData> = { // Send only changed fields potentially
            brand: formData.brand,
            cost: formData.cost, // Keep as string, Firestore service should parse
            fuelAmountLiters: formData.fuelAmountLiters, // Keep as string
            // Include logic based on mileageInputMethod if needed
        };

        const success = await onSave(log.id, updateData);
        setIsSaving(false);
        if (success) {
            onClose(); // Close modal on successful save
        } else {
            setSaveError("Failed to save changes.");
        }
    };

    if (!isOpen || !log || !formData) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Fuel Log</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                    {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
                    {/* Add form fields similar to QuickLogPage, pre-filled with formData */}
                    {/* Example: */}
                    <div>
                        <label htmlFor="edit-brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
                        <input
                            type="text"
                            id="edit-brand"
                            name="brand"
                            value={formData.brand}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                        />
                    </div>
                    {/* ... other fields for cost, litres, distance/odometer ... */}
                     <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main History Page Component ---

// Define processing function outside component for stability
const processFetchedLogs = (fetchedLogs: Log[], initialOdometerKm?: number): ProcessedLog[] => {
    if (!fetchedLogs || fetchedLogs.length === 0) {
        return [];
    }
    // Sort logs: oldest first for correct distance calculation if using odometer
    const sortedLogs = [...fetchedLogs].sort((a, b) => {
        const timeA = a.odometerKm ?? a.timestamp.toMillis(); // Prefer odometer if available for sorting
        const timeB = b.odometerKm ?? b.timestamp.toMillis();
        return timeA - timeB;
    });

    const processed = sortedLogs.map((log, index, arr) => {
        let calculatedDistanceKm: number | undefined = undefined;

        if (log.mileageInputMethod === 'distance' && log.distanceKm !== undefined) {
            calculatedDistanceKm = log.distanceKm >= 0 ? log.distanceKm : 0; // Ensure non-negative
        } else if (log.mileageInputMethod === 'odometer' && log.odometerKm !== undefined) {
            const previousLog = index > 0 ? arr[index - 1] : null;
            if (previousLog?.odometerKm !== undefined) {
                calculatedDistanceKm = log.odometerKm - previousLog.odometerKm;
            } else if (index === 0 && initialOdometerKm !== undefined && log.odometerKm >= initialOdometerKm) {
                // Calculate distance for the very first log based on vehicle's initial reading
                calculatedDistanceKm = log.odometerKm - initialOdometerKm;
            }
             // Handle potential negative distance (e.g., odometer typo correction) - treat as 0 distance for MPG calc?
            if (calculatedDistanceKm !== undefined && calculatedDistanceKm < 0) {
                console.warn(`Calculated negative distance for log ${log.id}. Setting to 0 for calculations.`);
                calculatedDistanceKm = 0;
            }
        }

        // Return the processed log structure
        return {
            ...log,
            distanceKm: calculatedDistanceKm ?? 0, // Default to 0 if undefined
        };
    });

    // Return logs sorted newest first for display
    return processed.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
};

// Firestore function to fetch logs for a specific vehicle
const fetchVehicleFuelLogs = async (userId: string, vehicleId: string): Promise<Log[]> => {
    if (!userId || !vehicleId) return [];
    console.log(`Fetching logs for user ${userId} and vehicle ${vehicleId}`); // Debug log
    const logsCollection = collection(db, 'fuelLogs');
    const q = query(
        logsCollection,
        where('userId', '==', userId),
        where('vehicleId', '==', vehicleId), // Filter by selected vehicle ID
        orderBy('timestamp', 'desc') // Fetch newest first initially
    );

    try {
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Log, 'id'>)
        }));
        console.log(`Fetched ${logs.length} logs`); // Debug log
        return logs;
    } catch (error) {
        console.error("Error fetching fuel logs:", error);
        throw error; // Re-throw error to be caught by calling function
    }
};

// Firestore function to update a specific log
const updateFuelLog = async (logId: string, data: Partial<EditFormData>): Promise<boolean> => {
    try {
        const logRef = doc(db, 'fuelLogs', logId);
        // Convert cost/litres back to numbers before updating
        const updateData: Partial<Log> = {
            brand: data.brand,
            cost: data.cost ? parseFloat(data.cost) : undefined,
            fuelAmountLiters: data.fuelAmountLiters ? parseFloat(data.fuelAmountLiters) : undefined,
            // Add logic to update distanceKm/odometerKm if they are part of EditFormData and allowed
        };

        // Remove undefined fields to avoid overwriting existing data unintentionally
        Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);

        if (Object.keys(updateData).length > 0) {
             await updateDoc(logRef, updateData);
             console.log("Log updated successfully:", logId);
             return true;
        } else {
            console.log("No changes detected to update for log:", logId);
            return true; // No changes is still a "success"
        }

    } catch (error) {
        console.error("Error updating fuel log:", error);
        return false;
    }
};


const HistoryPage: React.FC = () => {
    const { user } = useAuth();
    const { selectedVehicle } = useVehicle(); // Get selected vehicle from context
    const [_, setRawLogs] = useState<Log[]>([]); // Store fetched logs before processing
    const [processedLogs, setProcessedLogs] = useState<ProcessedLog[]>([]); // Store logs ready for display
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('table'); // Default view mode

    // State for Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<EditingLogState>(null);

    // --- Data Fetching and Processing ---
    const loadAndProcessData = useCallback(async () => {
        // Prevent fetching if no user or no vehicle is selected
        if (!user || !selectedVehicle) {
            console.log("Skipping fetch: No user or vehicle selected.");
            setRawLogs([]); // Clear raw logs
            setProcessedLogs([]); // Clear processed logs
            setIsLoading(false); // Stop loading indicator
            setError(null); // Clear previous errors
            return;
        }

        console.log(`Effect triggered: Loading data for vehicle ${selectedVehicle.id}`); // Debug log
        setIsLoading(true);
        setError(null);
        try {
            // Fetch raw logs for the selected vehicle
            const fetched = await fetchVehicleFuelLogs(user.uid, selectedVehicle.id);
            setRawLogs(fetched); // Store raw logs

            // Process the fetched logs
            const processed = processFetchedLogs(fetched, selectedVehicle.initialOdometerKm);
            setProcessedLogs(processed); // Set processed logs for UI
            console.log("Data processed:", processed.length, "logs"); // Debug log

        } catch (err) {
            console.error("Error in loadAndProcessData:", err);
            setError("Failed to load fuel history.");
            setRawLogs([]); // Clear on error
            setProcessedLogs([]); // Clear on error
        } finally {
            setIsLoading(false); // Ensure loading is set to false
            console.log("Finished loading/processing."); // Debug log
        }
    }, [user, selectedVehicle]); // Dependencies: user and selectedVehicle

    // Run the loading/processing effect when user or selectedVehicle changes
    useEffect(() => {
        console.log("useEffect triggered due to change in user or selectedVehicle"); // Debug log
        loadAndProcessData();
    }, [loadAndProcessData]); // Depend on the memoized function

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        // Use processedLogs which have consistent distanceKm
        return processedLogs
            .map(log => ({
                date: log.timestamp.toDate().toLocaleDateString('en-CA'), // YYYY-MM-DD for sorting
                timestampValue: log.timestamp.toMillis(),
                mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters),
                cost: log.cost,
                fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters),
            }))
            .filter(data => data.mpg !== null) // Only plot points with valid MPG
            .sort((a, b) => a.timestampValue - b.timestampValue); // Sort oldest to newest for chart
    }, [processedLogs]);

    // --- Event Handlers ---
    const handleCopyTableData = () => {
        const header = "Date\tBrand\tCost (€)\tLitres\tDistance (km)\tOdometer (km)\tkm/L\tMPG (UK)\tCost/Mile (€)";
        const rows = processedLogs.map(log => [
            log.timestamp.toDate().toLocaleDateString(),
            log.brand,
            log.cost.toFixed(2),
            log.fuelAmountLiters.toFixed(2),
            log.distanceKm.toFixed(1),
            log.odometerKm?.toLocaleString() ?? 'N/A',
            formatKmL(log.distanceKm, log.fuelAmountLiters),
            formatMPG(log.distanceKm, log.fuelAmountLiters),
            formatCostPerMile(log.cost, log.distanceKm)
        ].join('\t')).join('\n');

        navigator.clipboard.writeText(`${header}\n${rows}`)
            .then(() => alert('Table data copied to clipboard!'))
            .catch(err => console.error('Failed to copy table data: ', err));
    };

    const handleOpenEditModal = (logToEdit: ProcessedLog) => {
        console.log("Opening edit modal for:", logToEdit);
        setEditingLog(logToEdit); // Set the log to be edited
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingLog(null); // Clear the editing log state
    };

    const handleSaveEdit = async (logId: string, data: Partial<EditFormData>): Promise<boolean> => {
        // Call the Firestore update function
        const success = await updateFuelLog(logId, data);
        if (success) {
            // Refresh data if save was successful
            await loadAndProcessData();
        }
        return success;
    };


    const handleDeleteLog = async (logId: string) => {
        if (window.confirm('Are you sure you want to delete this log entry? This cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'fuelLogs', logId));
                console.log("Log deleted successfully:", logId);
                // Refresh the data after deletion
                await loadAndProcessData();
                 // Optionally: Show a success message
            } catch (error) {
                console.error("Error deleting log:", error);
                alert("Failed to delete log entry. Please try again.");
            }
        }
    };


    // --- Render Logic ---
    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">
                Fuel History {selectedVehicle ? `for ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationPlate})` : ''}
            </h1>

            {/* Vehicle Selection Info */}
            {!selectedVehicle && !isLoading && (
                 <p className="mb-4 text-center text-lg text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900 p-3 rounded-md">
                    Please select a vehicle from the dropdown above to view its history.
                 </p>
            )}

            {/* Loading and Error States */}
            {isLoading && <p className="text-center text-gray-600 dark:text-gray-400">Loading history...</p>}
            {error && <p className="text-center text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-300 p-3 rounded-md mb-4">{error}</p>}

            {/* Main Content Area (only show if not loading, no error, and vehicle selected) */}
            {!isLoading && !error && selectedVehicle && (
                <>
                    {/* Chart Section */}
                    {processedLogs.length > 1 && chartData.length > 0 && ( // Only show chart if enough data
                        <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">MPG (UK) Over Time</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc dark:#666" />
                                    <XAxis dataKey="date" fontSize={12} tick={{ fill: '#666 dark:#bbb' }} />
                                    <YAxis fontSize={12} tick={{ fill: '#666 dark:#bbb' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                                        itemStyle={{ color: '#333' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="mpg" stroke="#8884d8" activeDot={{ r: 8 }} name="MPG (UK)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* View Mode Toggle and Actions */}
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-2 rounded-l-md ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                aria-label="Table View"
                            >
                                <List size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`p-2 rounded-r-md ${viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                aria-label="Card View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                        </div>
                        <button
                            onClick={handleCopyTableData}
                            className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                            disabled={processedLogs.length === 0}
                        >
                            <FileDown size={16} className="mr-1" /> Copy Data
                        </button>
                    </div>

                    {/* Conditional Rendering based on View Mode */}
                    {processedLogs.length === 0 ? (
                         <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No fuel logs found for this vehicle.</p>
                    ) : viewMode === 'table' ? (
                        <LogTable logs={processedLogs} onEdit={handleOpenEditModal} onDelete={handleDeleteLog} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {processedLogs.map((log) => (
                                <LogCard
                                    key={log.id}
                                    log={log} // Pass the processed log
                                    onEdit={handleOpenEditModal}
                                    onDelete={handleDeleteLog}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Edit Modal */}
            <EditLogModal
                isOpen={isEditModalOpen}
                log={editingLog}
                onClose={handleCloseEditModal}
                onSave={handleSaveEdit}
            />

        </div>
    );
};

export default HistoryPage;

// src/components/LogCard.tsx
import { JSX } from 'react';
import { Timestamp } from 'firebase/firestore'; // Timestamp is still needed if Log uses it directly
import { Log } from '../utils/types'; // Import the shared Log type

// --- Remove Replicated Types & Functions ---
// const LITRES_TO_UK_GALLONS = 4.54609; ... (keep helper functions if they are not available globally or from utils)
// For now, assume helper functions (formatMPG, etc.) remain here, but ideally, they should be in a utils file.

// --- Updated LogCardProps ---
interface LogCardProps {
  log: Log; // Uses the imported Log type which includes optional vehicleId
  vehicleName?: string; // Optional: Name of the vehicle associated with the log
  onEdit: (log: Log) => void;
  onDelete: (logId: string) => void;
}

// Make sure helper functions are defined or imported. For this example, let's assume they are still here.
const LITRES_TO_UK_GALLONS = 4.54609; const KM_TO_MILES = 1 / 1.60934;
const formatMPG = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; const mpg = distanceMiles / gallonsUK; return mpg.toFixed(2); } catch { return 'Error'; } };
const formatCostPerMile = (cost: number, distanceKm: number): string => { if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const costPerMile = cost / distanceMiles; return `€${costPerMile.toFixed(3)}`; } catch { return 'Error'; } };
const formatKmL = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const kml = distanceKm / fuelAmountLiters; return kml.toFixed(2); } catch { return 'Error'; } };
const formatL100km = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const l100km = (fuelAmountLiters / distanceKm) * 100; return l100km.toFixed(2); } catch { return 'Error'; } };


function LogCard({ log, vehicleName, onEdit, onDelete }: LogCardProps): JSX.Element {

  const renderDataRow = (label: string, value: string | number | undefined | null, unit: string = '') => {
    const displayValue = value !== undefined && value !== null && value !== 'N/A' && value !== 'Error' ? `${value}${unit}` : '-';
    return (
      // Add dark mode text colors
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}:</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">{displayValue}</span>
      </div>
    );
  };

  return (
    // Add dark mode background, border, shadow
    <div className="bg-white dark:bg-gray-800 shadow-md dark:shadow-lg dark:shadow-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-3 transition-shadow hover:shadow-lg dark:hover:shadow-indigo-500/30">
      <div className="border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-indigo-700 dark:text-indigo-400">{log.brand || 'Unknown'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</span>
        </div>
        {vehicleName && ( // Display vehicle name if provided
          <div className="mt-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Vehicle: {vehicleName}
            </span>
          </div>
        )}
      </div>

      {/* Card Body - Data Rows */}
      <div className="space-y-1">
        {renderDataRow("Cost", log.cost?.toFixed(2), " €")}
        {renderDataRow("Distance", log.distanceKm?.toFixed(1), " Km")}
        {renderDataRow("Fuel", log.fuelAmountLiters?.toFixed(2), " L")}
        {/* Vehicle ID could be displayed for debugging, but typically not needed if name is shown */}
        {/* log.vehicleId && renderDataRow("Vehicle ID", log.vehicleId) */}
        <hr className="my-2 border-gray-100 dark:border-gray-700"/>
        {renderDataRow("km/L", formatKmL(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("L/100km", formatL100km(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("MPG (UK)", formatMPG(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("Cost/Mile", formatCostPerMile(log.cost, log.distanceKm))}
      </div>

      {/* Card Footer - Actions */}
      <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
        {/* Edit and Delete buttons remain the same */}
        <button
          onClick={() => onEdit(log)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 rounded hover:bg-indigo-100 dark:hover:bg-gray-700 transition duration-150 ease-in-out"
          title="Edit Log"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          <span className="sr-only">Edit</span> {/* Screen reader text */}
        </button>
        {/* Delete Button with Trash Icon */}
        <button
          onClick={() => onDelete(log.id)}
          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-gray-700 transition duration-150 ease-in-out"
          title="Delete Log"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          <span className="sr-only">Delete</span> {/* Screen reader text */}
        </button>
      </div>
    </div>
  );
}

export default LogCard;

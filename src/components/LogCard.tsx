// src/components/LogCard.tsx
import { JSX } from 'react';
import { Log } from '../utils/types';
import { formatMPG, formatCostPerMile, formatKmL, formatL100km } from '../utils/calculations';

interface LogCardProps { 
  log: Log; 
  onEdit: (log: Log) => void; 
  onDelete: (logId: string) => void; 
  vehicleName?: string;
}

function LogCard({ log, onEdit, onDelete, vehicleName }: LogCardProps): JSX.Element {

  const renderDataRow = (label: string, value: string | number | undefined | null, unit: string = '', subtitle?: string) => {
    const displayValue = value !== undefined && value !== null && value !== 'N/A' && value !== 'Error' ? `${value}${unit}` : '-';
    return (
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}:</span>
        <div className="flex flex-col items-end">
            <span className="font-medium text-gray-800 dark:text-gray-200">{displayValue}</span>
            {subtitle && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">{subtitle}</span>}
        </div>
      </div>
    );
  };

  const costSubtitle = log.currency && log.currency !== 'EUR' 
    ? `${log.originalCost?.toFixed(2)} ${log.currency} (@ ${log.exchangeRate})`
    : undefined;

  return (
    // Add dark mode background, border, shadow
    <div className="bg-white dark:bg-gray-800 shadow-md dark:shadow-lg dark:shadow-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-3 transition-shadow hover:shadow-lg dark:hover:shadow-indigo-500/30">
      {/* Card Header - Add dark mode colors */}
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
        <span className="font-semibold text-indigo-700 dark:text-indigo-400">{log.brand || 'Unknown'}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</span>
      </div>

      {/* Card Body - Data Rows (styles handled by renderDataRow) */}
      <div className="space-y-1">
        {vehicleName && renderDataRow("Vehicle", vehicleName)}
        {renderDataRow("Cost", log.cost?.toFixed(2), " €", costSubtitle)}
        {renderDataRow("Distance", log.distanceKm?.toFixed(1), " Km")}
        {renderDataRow("Fuel", log.fuelAmountLiters?.toFixed(2), " L")}
        <hr className="my-2 border-gray-100 dark:border-gray-700"/> {/* Separator */}
        {renderDataRow("km/L", formatKmL(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("L/100km", formatL100km(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("MPG (UK)", formatMPG(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("Cost/Mile", formatCostPerMile(log.cost, log.distanceKm))}
      </div>

      {/* Card Footer - Actions - Add dark mode hover colors */}
      <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
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

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

  const renderMetric = (label: string, value: string | number | undefined | null, unit: string = '') => {
    const displayValue = value !== undefined && value !== null && value !== 'N/A' && value !== 'Error' ? `${value}${unit}` : '-';
    return (
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tight">{label}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{displayValue}</span>
      </div>
    );
  };

  const costValue = log.cost?.toFixed(2);
  const originalCostInfo = log.currency && log.currency !== 'EUR' 
    ? `${log.originalCost?.toFixed(2)} ${log.currency}`
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50 flex flex-col space-y-4 transition-all active:scale-[0.98]">
      {/* Header: Date & Vehicle */}
      <div className="flex justify-between items-start">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            {log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) ?? 'N/A'}
          </p>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            {log.brand || 'Unknown Station'}
          </h4>
          {vehicleName && (
            <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-medium mt-1">
              {vehicleName}
            </span>
          )}
        </div>
        
        {/* Main Price Highlight */}
        <div className="text-right">
          <p className="text-xl font-black text-gray-900 dark:text-white">€{costValue}</p>
          {originalCostInfo && (
            <p className="text-[10px] text-gray-400 font-medium italic">{originalCostInfo}</p>
          )}
        </div>
      </div>

      {/* Grid: Primary Data */}
      <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-50 dark:border-gray-700/50">
        {renderMetric("Distance", log.distanceKm?.toFixed(1), " Km")}
        {renderMetric("Fuel Added", log.fuelAmountLiters?.toFixed(2), " L")}
      </div>

      {/* Grid: Efficiency Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {renderMetric("MPG", formatMPG(log.distanceKm, log.fuelAmountLiters))}
        {renderMetric("km/L", formatKmL(log.distanceKm, log.fuelAmountLiters))}
        {renderMetric("L/100km", formatL100km(log.distanceKm, log.fuelAmountLiters))}
        {renderMetric("Cost/Mile", formatCostPerMile(log.cost, log.distanceKm))}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-2">
        <button
          onClick={() => onEdit(log)}
          className="flex items-center justify-center p-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 rounded-xl transition-colors"
          title="Edit Entry"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(log.id)}
          className="flex items-center justify-center p-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-xl transition-colors"
          title="Delete Entry"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default LogCard;

// src/components/LogCard.tsx
import { JSX } from 'react';
import { Log } from '../utils/types'; // Adjust the import path as necessary
import { formatKmL, formatL100km, formatMPG, formatCostPerMile } from '../utils/calculations';

// Props for the LogCard component
interface LogCardProps {
  log: Log;
  onEdit: (log: Log) => void; // Function to call when Edit is clicked
  onDelete: (logId: string) => void; // Function to call when Delete is clicked
}

function LogCard({ log, onEdit, onDelete }: LogCardProps): JSX.Element {

  // Helper function to render a data row within the card
  const renderDataRow = (label: string, value: string | number | undefined | null, unit: string = '') => {
    const displayValue = value !== undefined && value !== null && value !== 'N/A' && value !== 'Error' ? `${value}${unit}` : '-';
    return (
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}:</span>
        <span className="font-medium text-gray-800">{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200 flex flex-col justify-between space-y-3 transition-shadow hover:shadow-lg">
      {/* Card Header */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
        <span className="font-semibold text-indigo-700">{log.brand || 'Unknown'}</span>
        <span className="text-xs text-gray-500">{log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A'}</span>
      </div>

      {/* Card Body - Data Rows */}
      <div className="space-y-1">
        {renderDataRow("Cost", log.cost?.toFixed(2), " €")}
        {renderDataRow("Distance", log.distanceKm?.toFixed(1), " Km")}
        {renderDataRow("Fuel", log.fuelAmountLiters?.toFixed(2), " L")}
        <hr className="my-2 border-gray-100"/> {/* Separator */}
        {renderDataRow("km/L", formatKmL(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("L/100km", formatL100km(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("MPG (UK)", formatMPG(log.distanceKm, log.fuelAmountLiters))}
        {renderDataRow("Cost/Mile", formatCostPerMile(log.cost, log.distanceKm))}
      </div>

      {/* Card Footer - Actions */}
      <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100 mt-2">
        <button
          onClick={() => onEdit(log)} // Pass the whole log object up
          className="text-xs text-indigo-600 hover:text-indigo-900 font-medium transition duration-150 ease-in-out"
          title="Edit Log"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(log.id)} // Pass only the ID up
          className="text-xs text-red-600 hover:text-red-900 font-medium transition duration-150 ease-in-out"
          title="Delete Log"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default LogCard;

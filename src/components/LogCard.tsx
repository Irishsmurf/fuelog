// src/components/LogCard.tsx
import { JSX, useState } from 'react';
import { Log } from '../utils/types';
import { formatMPG, formatCostPerMile, formatKmL, formatL100km } from '../utils/calculations';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Info, Edit3, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { COMMON_CURRENCIES } from '../utils/currencyApi';

// CSS for card flip and map container
import 'leaflet/dist/leaflet.css';

// --- Icon Fix (points to public assets) ---
const iconRetinaUrl = '/marker-icon-2x.png';
const iconUrl = '/marker-icon.png';
const shadowUrl = '/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
// --- End Icon Fix ---

interface LogCardProps { 
  log: Log; 
  onEdit: (log: Log) => void; 
  onDelete: (logId: string) => void; 
  vehicleName?: string;
}

/** Small helper to fix the map view when flipping */
const RecenterMap = ({ center }: { center: L.LatLngExpression }) => {
    const map = useMap();
    setTimeout(() => { map.invalidateSize(); map.setView(center, 15); }, 100);
    return null;
};

function LogCard({ log, onEdit, onDelete, vehicleName }: LogCardProps): JSX.Element {
  const { profile } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);
  const hasGeo = log.latitude !== undefined && log.longitude !== undefined;

  const homeCurrency = profile?.homeCurrency || 'EUR';
  const homeCurrencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

  const renderMetric = (label: string, value: string | number | undefined | null, unit: string = '') => {
    const displayValue = value !== undefined && value !== null && value !== 'N/A' && value !== 'Error' ? `${value}${unit}` : '-';
    return (
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tight">{label}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-mono tracking-tighter">{displayValue}</span>
      </div>
    );
  };

  const costValue = log.cost?.toFixed(2);
  const originalCostInfo = log.currency && log.currency !== homeCurrency 
    ? `${log.originalCost?.toFixed(2)} ${log.currency}`
    : null;

  const handleFlip = (e: React.MouseEvent) => {
    // Don't flip if clicking action buttons
    if ((e.target as HTMLElement).closest('button')) return;
    if (hasGeo) setIsFlipped(!isFlipped);
  };

  const center: L.LatLngExpression = [log.latitude || 0, log.longitude || 0];

  return (
    <div 
      className="relative w-full h-[320px] perspective-1000 group"
      onClick={handleFlip}
    >
      <div className={`relative w-full h-full transition-all duration-500 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* FRONT: Log Details */}
        <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 shadow-md rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700/50 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-0.5 min-w-0 flex-grow">
              <div className="flex items-center space-x-1.5">
                <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest truncate">
                    {log.timestamp?.toDate().toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) ?? 'N/A'}
                </p>
                {hasGeo && <MapPin size={10} className="text-brand-primary shrink-0 animate-pulse" />}
              </div>
              <h4 className="text-lg font-black tracking-tight text-gray-900 dark:text-white leading-tight truncate">
                {log.brand || 'Unknown Station'}
              </h4>
              {vehicleName && (
                <span className="inline-block bg-brand-primary/5 text-brand-primary text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 border border-brand-primary/10">
                  {vehicleName}
                </span>
              )}
            </div>
            
            <div className="text-right shrink-0 ml-2">
              <p className="text-xl font-black text-gray-900 dark:text-white font-mono leading-none">{homeCurrencySymbol}{costValue}</p>
              {originalCostInfo && (
                <p className="text-[9px] text-gray-400 font-bold italic font-mono mt-1 uppercase">{originalCostInfo}</p>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-gray-50 dark:border-gray-700/50 mb-3">
            {renderMetric("Distance", log.distanceKm?.toFixed(1), " Km")}
            {renderMetric("Fuel Added", log.fuelAmountLiters?.toFixed(2), " L")}
          </div>

          {/* Efficiency Grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
            {renderMetric("MPG", formatMPG(log.distanceKm, log.fuelAmountLiters))}
            {renderMetric("km/L", formatKmL(log.distanceKm, log.fuelAmountLiters))}
            {renderMetric("L/100km", formatL100km(log.distanceKm, log.fuelAmountLiters))}
            {renderMetric("Cost/Mile", formatCostPerMile(log.cost, log.distanceKm))}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-50 dark:border-gray-700/50 mt-auto">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                {hasGeo ? "Tap to view map" : "No location"}
            </span>
            <div className="flex space-x-2">
                <button
                onClick={(e) => { e.stopPropagation(); onEdit(log); }}
                className="flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-500 hover:text-brand-primary dark:text-gray-400 dark:hover:text-brand-primary rounded-xl transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                title="Edit Entry"
                >
                <Edit3 size={16} />
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                className="flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                title="Delete Entry"
                >
                <Trash2 size={16} />
                </button>
            </div>
          </div>
        </div>

        {/* BACK: Map View */}
        <div className="absolute inset-0 rotate-y-180 backface-hidden bg-white dark:bg-gray-800 shadow-md rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 flex flex-col">
          <div className="flex-grow relative bg-gray-100 dark:bg-gray-900">
            {isFlipped && hasGeo && (
              <MapContainer center={center} zoom={15} zoomControl={false} dragging={false} touchZoom={false} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={center} />
                <RecenterMap center={center} />
              </MapContainer>
            )}
            <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">{log.brand || 'Location'}</p>
            </div>
            <button 
                className="absolute bottom-3 right-3 z-[1000] bg-brand-primary text-white p-2.5 rounded-xl shadow-lg shadow-brand-primary/30"
                onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
            >
                <Info size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LogCard;

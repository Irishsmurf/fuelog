// src/components/LogCard.tsx
import { JSX, useState } from 'react';
import { Log } from '../utils/types';
import { formatMPG, formatCostPerMile, formatKmL, formatL100km } from '../utils/calculations';
import { sanitizeUrl } from '../utils/sanitize';
import { formatDate } from '../utils/formatDate';
import { MapPin, Edit3, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { COMMON_CURRENCIES } from '../utils/currencyApi';
import { useTranslation } from 'react-i18next';
import ReceiptModal from './ReceiptModal';

interface LogCardProps {
  log: Log;
  onEdit: (log: Log) => void;
  onDelete: (logId: string) => void;
  vehicleName?: string;
  stationName?: string;
}

function LogCard({ log, onEdit, onDelete, vehicleName, stationName }: LogCardProps): JSX.Element {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
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

  return (
    <>
    <div className="relative w-full h-[320px] group">
        <div data-testid="log-card-body" className="absolute inset-0 nocturne-card rounded-2xl p-4 sm:p-5 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-0.5 min-w-0 flex-grow">
              <div className="flex items-center space-x-1.5">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest truncate">
                    {log.timestamp?.toDate() ? formatDate(log.timestamp.toDate()) : 'N/A'}
                </p>
                {hasGeo && <MapPin size={10} className="text-brand-primary shrink-0" />}
              </div>
              <h4 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight truncate">
                {stationName || log.brand || t('logCard.unknownStation')}
              </h4>
              {vehicleName && (
                <span className="nocturne-tag-neutral mt-1">
                  {vehicleName}
                </span>
              )}
            </div>

            <div className="text-right shrink-0 ml-2">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono leading-none">{homeCurrencySymbol}{costValue}</p>
              {originalCostInfo && (
                <p className="text-[9px] text-gray-400 font-bold italic font-mono mt-1 uppercase">{originalCostInfo}</p>
              )}
            </div>
          </div>
{/* Metrics Grid */}
<div className="grid grid-cols-2 gap-3 py-3 border-y border-gray-200 dark:border-gray-700/60 mb-3">
  {log.odometerKm !== undefined && log.odometerKm !== null ? (
    <>
      {renderMetric(t('history.table.odometer'), log.odometerKm.toFixed(0), " Km")}
      {renderMetric(t('logCard.distance'), log.distanceKm?.toFixed(1), " Km")}
    </>
  ) : (
    <>
      {renderMetric(t('logCard.distance'), log.distanceKm?.toFixed(1), " Km")}
      {renderMetric(t('logCard.fuelAdded'), log.fuelAmountLiters?.toFixed(2), " L")}
    </>
  )}
</div>

{/* Efficiency Grid */}
<div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
  {log.odometerKm !== undefined && log.odometerKm !== null && renderMetric(t('logCard.fuelAdded'), log.fuelAmountLiters?.toFixed(2), " L")}
  {renderMetric(t('logCard.mpg'), formatMPG(log.distanceKm, log.fuelAmountLiters))}
  {renderMetric(t('logCard.kmL'), formatKmL(log.distanceKm, log.fuelAmountLiters))}
  {renderMetric(t('logCard.l100km'), formatL100km(log.distanceKm, log.fuelAmountLiters))}
  {renderMetric(t('logCard.costPerMile'), formatCostPerMile(log.cost, log.distanceKm, homeCurrencySymbol))}
</div>

          {/* Receipt Section */}
          {log.receiptUrl && (
            <div className="mb-3">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tight block mb-1">{t('logCard.receipt')}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsReceiptOpen(true); }}
                className="inline-block relative rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 hover:opacity-80 transition-opacity"
              >
                <img src={sanitizeUrl(log.receiptUrl!)} alt="Receipt" className="h-10 w-16 object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <FileText size={12} className="text-white" />
                </div>
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end items-center pt-3 border-t border-gray-200 dark:border-gray-700/60 mt-auto">
            <div className="flex space-x-2">
                <button
                onClick={(e) => { e.stopPropagation(); onEdit(log); }}
                className="flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-500 hover:text-brand-primary dark:text-gray-400 dark:hover:text-brand-primary rounded-xl transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                title={t('logCard.editEntry')}
                >
                <Edit3 size={16} />
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                className="flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                title={t('logCard.deleteEntry')}
                >
                <Trash2 size={16} />
                </button>
            </div>
          </div>
        </div>

    </div>
    {isReceiptOpen && log.receiptUrl && (
      <ReceiptModal url={log.receiptUrl} onClose={() => setIsReceiptOpen(false)} />
    )}
    </>
  );
}

export default LogCard;

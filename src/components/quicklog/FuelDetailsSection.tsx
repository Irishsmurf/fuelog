// Transaction details: date/time, cost + currency (with exchange rate),
// odometer, distance and fuel amount.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_CURRENCIES } from '../../utils/currencyApi';
import { toDatetimeLocal } from '../../utils/formatDate';
import type { QuickLogFields } from '../../hooks/useQuickLogFields';
import type { ExchangeRateState } from '../../hooks/useExchangeRate';
import OdometerHint from './OdometerHint';

interface Props {
  fields: QuickLogFields;
  rate: ExchangeRateState;
  homeCurrency: string;
  currencySymbol: string;
  lastOdometerReading: number | null;
  isSaving: boolean;
}

const Chevron = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
);
const Unit = ({ children }: { children: string }) => (
  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">{children}</span>
  </div>
);

export default function FuelDetailsSection({ fields: f, rate, homeCurrency, currencySymbol, lastOdometerReading, isSaving }: Props): JSX.Element {
  const { t } = useTranslation();
  const { currency } = rate;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="loggedAt" className="nocturne-label">{t('quickLog.fields.dateTime', { defaultValue: 'Date & time of fuelling' })}</label>
        <input type="datetime-local" id="loggedAt" value={f.loggedAt} max={toDatetimeLocal(new Date())} onChange={(e) => f.setLoggedAt(e.target.value)} className="nocturne-input" disabled={isSaving} />
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3">
          <label htmlFor="cost" className="nocturne-label">{t('quickLog.fields.totalCost')}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{currencySymbol}</span>
            </div>
            <input type="number" inputMode="decimal" id="cost" value={f.cost} onChange={(e) => f.setCost(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required className="nocturne-input pl-8 fuel-numeral" disabled={isSaving} />
          </div>
        </div>
        <div className="col-span-2">
          <label htmlFor="currency" className="nocturne-label">{t('quickLog.fields.currency')}</label>
          <div className="relative">
            <select id="currency" value={currency} onChange={(e) => rate.setCurrency(e.target.value)} className="nocturne-input appearance-none cursor-pointer" disabled={isSaving}>
              {COMMON_CURRENCIES.map((curr) => ( <option key={curr.code} value={curr.code}>{curr.code}</option> ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"><Chevron /></div>
          </div>
        </div>
      </div>

      {currency !== homeCurrency && (
        <div className="nocturne-card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label htmlFor="exchangeRate" className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('quickLog.fields.exchangeRate', { currency, homeCurrency })}
            </label>
            {rate.isFetchingRate && <span className="text-[10px] bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-100 px-2 py-0.5 rounded-md animate-pulse">{t('quickLog.fields.fetching')}</span>}
          </div>
          <input type="number" inputMode="decimal" id="exchangeRate" value={rate.exchangeRate} onChange={rate.handleRateChange} step="0.0001" min="0.0001" className="nocturne-input fuel-numeral" disabled={isSaving} />
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 mb-0">
            {t('quickLog.fields.converted', { symbol: currencySymbol, amount: (parseFloat(f.cost || '0') * rate.exchangeRate).toFixed(2) })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-2">
        <div>
          <label htmlFor="odometer" className="nocturne-label text-[10px]">{t('quickLog.fields.odometer')}</label>
          <input type="number" inputMode="decimal" id="odometer" value={f.odometerKm} onChange={(e) => f.setOdometerKm(e.target.value)} placeholder="0" step="1" min="0" className="nocturne-input fuel-numeral" disabled={isSaving} />
        </div>
        <div>
          <label htmlFor="distance" className="nocturne-label text-[10px]">{t('quickLog.fields.distance')}</label>
          <div className="relative">
            <input type="number" inputMode="decimal" id="distance" value={f.distanceKm} onChange={(e) => f.setDistanceKm(e.target.value)} placeholder="0.0" step="0.1" min="0.1" required className="nocturne-input fuel-numeral pr-9" disabled={isSaving} />
            <Unit>km</Unit>
          </div>
        </div>
        <div>
          <label htmlFor="fuelAmount" className="nocturne-label text-[10px]">{t('quickLog.fields.fuel')}</label>
          <div className="relative">
            <input type="number" inputMode="decimal" id="fuelAmount" value={f.fuelAmountLiters} onChange={(e) => f.setFuelAmountLiters(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required className="nocturne-input fuel-numeral pr-7" disabled={isSaving} />
            <Unit>L</Unit>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="nocturne-seg" role="radiogroup" aria-label={t('quickLog.fields.fillType')}>
          {(['full', 'partial'] as const).map((type) => (
            <label key={type} className="nocturne-seg-opt relative">
              <input type="radio" name="fillType" value={type} checked={f.fillType === type} onChange={() => f.setFillType(type)} disabled={isSaving} />
              {t(`quickLog.fields.fillType_${type}`)}
            </label>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" id="missedPrevious" checked={f.missedPrevious} onChange={(e) => f.setMissedPrevious(e.target.checked)} disabled={isSaving} className="h-4 w-4 accent-brand-primary" />
          {t('quickLog.fields.missedPrevious')}
        </label>
      </div>

      {f.odometerKm && (
        <div className="mt-2">
          <OdometerHint odometerKm={f.odometerKm} lastReading={lastOdometerReading} />
        </div>
      )}
    </div>
  );
}

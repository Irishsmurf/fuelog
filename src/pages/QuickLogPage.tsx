// src/pages/QuickLogPage.tsx
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../data/vehicleHooks';
import { useLastOdometerReading, useRecentBrands } from '../data/logHooks';
import { pickDefaultVehicle } from '../data/vehicles';
import { COMMON_CURRENCIES } from '../utils/currencyApi';
import { useOdometerDistance, useQuickLogFields } from '../hooks/useQuickLogFields';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useLocationPin } from '../hooks/useLocationPin';
import { useReceiptExtraction } from '../hooks/useReceiptExtraction';
import { useQuickLogSubmit } from '../hooks/useQuickLogSubmit';
import ReceiptAISection from '../components/ReceiptAISection';
import VehicleAndBrandFields from '../components/quicklog/VehicleAndBrandFields';
import LocationSection from '../components/quicklog/LocationSection';
import FuelDetailsSection from '../components/quicklog/FuelDetailsSection';
import SaveControls from '../components/quicklog/SaveControls';
import NoVehiclesPrompt, { LoadingVehicles } from '../components/quicklog/NoVehiclesPrompt';
import type { MessageState } from '../components/quicklog/types';
import type { Vehicle } from '../utils/types';

const NO_VEHICLES: Vehicle[] = [];
const NO_BRANDS: string[] = [];

function QuickLogPage(): JSX.Element {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const uid = user?.uid;
  const homeCurrency = profile?.homeCurrency || 'EUR';
  const currencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });
  const [stationWarning, setStationWarning] = useState<string>('');

  // --- Vehicles: the user's pick, else the default (re-derived when the list changes) ---
  const vehiclesQuery = useVehicles(uid);
  const vehicles = vehiclesQuery.data ?? NO_VEHICLES;
  const [pickedVehicleId, setPickedVehicleId] = useState<string>('');
  const vehicleId = vehicles.some(v => v.id === pickedVehicleId)
    ? pickedVehicleId
    : pickDefaultVehicle(vehicles)?.id ?? '';

  const brandsQuery = useRecentBrands(uid);
  const fields = useQuickLogFields();

  // --- Odometer: closest earlier reading, used to derive the distance ---
  const odometerQuery = useLastOdometerReading(uid, vehicleId, fields.loggedAtDate);
  const lastOdometerReading = vehicleId ? odometerQuery.data ?? null : null;
  useOdometerDistance(fields, lastOdometerReading);
  // Report each failed lookup once (state adjusted during render, not in an effect).
  const [reportedOdometerError, setReportedOdometerError] = useState(0);
  if (odometerQuery.isError && odometerQuery.errorUpdatedAt !== reportedOdometerError) {
    setReportedOdometerError(odometerQuery.errorUpdatedAt);
    setMessage({
      type: 'error',
      text: !navigator.onLine
        ? t('quickLog.messages.offline', { defaultValue: 'You are offline. Please check your connection and try again.' })
        : t('quickLog.messages.fetchOdometerError', { defaultValue: 'Failed to load last odometer reading.' }),
    });
  }

  const rate = useExchangeRate({ homeCurrency, rateDate: fields.loggedAtDate, setMessage, t });
  const pin = useLocationPin({ setBrand: fields.setBrand, setStationWarning, t });
  const receipt = useReceiptExtraction({ fields, pin, setMessage, t });
  const { handleSubmit, isSaving, savingStep } = useQuickLogSubmit({
    user, hasVehicles: vehicles.length > 0, vehicleId, fields, rate, pin, receipt, setMessage, setStationWarning, t,
  });
  const isLoadingBrands = !!uid && brandsQuery.isPending;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 relative transition-colors duration-500">
      <div className="container mx-auto max-w-lg relative z-10">
        <div>
          <h2 className="text-2xl font-display font-medium tracking-tight text-gray-900 dark:text-gray-100 mb-6">
            {t('quickLog.title')}
          </h2>

          {!!uid && vehiclesQuery.isPending ? (
            <LoadingVehicles />
          ) : vehicles.length === 0 ? (
            <NoVehiclesPrompt />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <VehicleAndBrandFields
                vehicles={vehicles}
                vehicleId={vehicleId}
                onVehicleChange={setPickedVehicleId}
                brand={fields.brand}
                onBrandChange={fields.setBrand}
                knownBrands={brandsQuery.data ?? NO_BRANDS}
                isSaving={isSaving}
                isLoadingBrands={isLoadingBrands}
              />

              <LocationSection pin={pin} isSaving={isSaving} />

              <FuelDetailsSection
                fields={fields}
                rate={rate}
                homeCurrency={homeCurrency}
                currencySymbol={currencySymbol}
                lastOdometerReading={lastOdometerReading}
                isSaving={isSaving}
              />

              <div>
                <ReceiptAISection
                  receiptFile={receipt.receiptFile}
                  setReceiptFile={receipt.setReceiptFile}
                  isExtracting={receipt.isExtracting}
                  extractedData={receipt.extractedData}
                  setExtractedData={receipt.setExtractedData}
                  handleExtractData={receipt.handleExtractData}
                  handleConfirmExtraction={receipt.handleConfirmExtraction}
                  handleCancelExtraction={receipt.handleCancelExtraction}
                />
              </div>

              <SaveControls
                isSaving={isSaving}
                disabled={isSaving || isLoadingBrands}
                savingStep={savingStep}
                stationWarning={stationWarning}
                message={message}
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuickLogPage;

// src/pages/QuickLogPage.tsx
import React, { JSX, useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db, analytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';
import { useAuth } from '../context/AuthContext';
import { fetchExchangeRate, COMMON_CURRENCIES } from '../utils/currencyApi';
import { Vehicle } from '../utils/types';
import { Link } from 'react-router-dom';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { uploadReceipt } from '../firebase/storageService';
import { extractDataFromReceipt, ReceiptData } from '../utils/gemini';
import ReceiptAISection from '../components/ReceiptAISection';
import { useTranslation } from 'react-i18next';

// Types
type MessageType = 'success' | 'error' | 'info' | '';
interface MessageState {
  type: MessageType;
  text: string;
}
// Type for location data we want to store
interface LocationData {
    latitude: number;
    longitude: number;
    locationAccuracy: number;
}


function QuickLogPage(): JSX.Element {
  const { user, profile } = useAuth();
  const { getBoolean } = useRemoteConfig();
  const { t } = useTranslation();
  const receiptDigitizationEnabled = getBoolean('receiptDigitizationEnabled');
  const receiptAutoFillEnabled = getBoolean('receiptAutoFillEnabled');

  const [brand, setBrand] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [distanceKmInput, setDistanceKmInput] = useState<string>('');
  const [fuelAmountLiters, setFuelAmountLiters] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingStep, setSavingStep] = useState<'locating' | 'saving'>('saving');
  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState<boolean>(false);

  const homeCurrency = profile?.homeCurrency || 'EUR';

  // --- Multi-Vehicle State ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);

  // --- Multi-Currency State ---
  const [currency, setCurrency] = useState<string>(homeCurrency); // Transaction Currency
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [isFetchingRate, setIsFetchingRate] = useState<boolean>(false);

  // --- Receipt State ---
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ReceiptData | null>(null);

  // --- Handle AI Extraction ---
  const handleExtractData = async () => {
    if (!receiptFile) return;
    setIsExtracting(true);
    setExtractedData(null);
    setMessage({ type: 'info', text: t('receipt.analyzing') });
    try {
      const data = await extractDataFromReceipt(receiptFile);
      setExtractedData(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error("Extraction error:", error);
      setMessage({ type: 'error', text: t('receipt.extractionFailed') });
    } finally {
      setIsExtracting(false);
    }
  };

  // --- Confirm Extracted Data ---
  const handleConfirmExtraction = () => {
    if (extractedData) {
      if (extractedData.cost != null) setCost(extractedData.cost.toString());
      if (extractedData.fuelAmountLiters != null) setFuelAmountLiters(extractedData.fuelAmountLiters.toString());
      if (extractedData.brand != null) setBrand(extractedData.brand);
      setExtractedData(null);
      setMessage({ type: 'success', text: t('receipt.autoFilled') });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  // --- Cancel Extraction ---
  const handleCancelExtraction = () => {
    setExtractedData(null);
  };

  // Reset currency when homeCurrency changes (initial load)
  useEffect(() => {
    setCurrency(homeCurrency);
  }, [homeCurrency]);

  // --- Fetch Vehicles ---
  useEffect(() => {
    if (!user) return;
    const fetchVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const list: Vehicle[] = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Vehicle));
        const activeList = list.filter(v => !v.isArchived);
        setVehicles(activeList.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        const defaultVehicle = activeList.find(v => v.isDefault) || activeList[0];
        if (defaultVehicle) setSelectedVehicleId(defaultVehicle.id);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, [user, t]);

  // --- Fetch Exchange Rate when currency changes ---
  useEffect(() => {
    if (currency === homeCurrency) {
      setExchangeRate(1.0);
      return;
    }

    const getRate = async () => {
      setIsFetchingRate(true);
      try {
        const rate = await fetchExchangeRate(new Date(), currency, homeCurrency);
        setExchangeRate(rate);
      } catch (error) {
        console.error("Failed to fetch rate:", error);
        setMessage({ type: 'error', text: t('quickLog.messages.fetchRateError', { currency }) });
      } finally {
        setIsFetchingRate(false);
      }
    };

    getRate();
  }, [currency, homeCurrency, t]);

  // --- Fetch known brands effect ---
  useEffect(() => {
    if (!user) { setKnownBrands([]); return; }
    const fetchBrands = async () => {
      setIsLoadingBrands(true);
      try {
        const q = query(collection(db, "fuelLogs"), where("userId", "==", user.uid));
        const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
        const brands = new Set<string>();
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.brand && data.brand.toLowerCase() !== 'unknown') { brands.add(data.brand.trim()); }
        });
        const sortedBrands = Array.from(brands).sort((a, b) => a.localeCompare(b));
        setKnownBrands(sortedBrands);
      } catch (error) { console.error("Error fetching known brands:", error); }
      finally { setIsLoadingBrands(false); }
    };
    fetchBrands();
  }, [user, t]);

  // --- Input Change Handler ---
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setter(e.target.value); };

  // --- Exchange Rate Change Handler ---
  const handleRateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setExchangeRate(isNaN(val) ? 0 : val);
  };

  // --- Function to get Geolocation wrapped in a Promise ---
  const getCurrentLocation = (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            locationAccuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn(`Geolocation error (${error.code}): ${error.message}`);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };


  // --- Form Submit Handler ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basic validation
    if (!user) { setMessage({ type: 'error', text: t('quickLog.messages.mustBeLoggedIn') }); return; }
    if (vehicles.length === 0) { setMessage({ type: 'error', text: t('quickLog.messages.addVehicleFirst') }); return; }
    if (!selectedVehicleId) { setMessage({ type: 'error', text: t('quickLog.messages.selectVehicle') }); return; }
    if (!cost || !distanceKmInput || !fuelAmountLiters) { setMessage({ type: 'error', text: t('quickLog.messages.fillRequired') }); return; }

    const parsedCost = parseFloat(cost);
    const parsedDistanceKm = parseFloat(distanceKmInput);
    const parsedFuel = parseFloat(fuelAmountLiters);

    if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) {
      setMessage({ type: 'error', text: t('quickLog.messages.validNumbers') });
      return;
    }

    setIsSaving(true);
    setSavingStep('locating');
    setMessage({ type: 'info', text: t('quickLog.messages.gettingLocation') });

    // --- Get Location ---
    const locationData = await getCurrentLocation();
    setSavingStep('saving');
    let locationMessage: string;
    if (locationData) {
        locationMessage = t('quickLog.messages.locationCaptured', { accuracy: locationData.locationAccuracy.toFixed(0) });
    } else if (!navigator.geolocation) {
        locationMessage = t('quickLog.messages.locationNotSupported');
    } else {
        locationMessage = t('quickLog.messages.locationNotSupported');
    }
    // --- End Get Location ---

    setMessage({ type: 'info', text: t('quickLog.messages.savingLog', { locationMsg: locationMessage }) });

    try {
      // --- Handle Receipt Upload ---
      let receiptUrl = "";
      if (receiptFile && user) {
        setMessage({ type: 'info', text: t('quickLog.messages.uploadingReceipt') });
        receiptUrl = await uploadReceipt(receiptFile, user.uid);
      }

      // Calculate cost in home currency
      const costHomeCurrency = parsedCost * exchangeRate;

      // Prepare data object, including location if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logData: any = {
        userId: user.uid,
        vehicleId: selectedVehicleId,
        timestamp: Timestamp.now(),
        brand: brand.trim() || 'Unknown',
        cost: costHomeCurrency,
        distanceKm: parsedDistanceKm,
        fuelAmountLiters: parsedFuel,
        currency: currency,
        originalCost: parsedCost,
        exchangeRate: exchangeRate,
        receiptUrl: receiptUrl || null
      };
      if (locationData) {
        logData.latitude = locationData.latitude;
        logData.longitude = locationData.longitude;
        logData.locationAccuracy = locationData.locationAccuracy;
      }

      // Save to Firestore
      await addDoc(collection(db, "fuelLogs"), logData);
      analytics.then(a => { if (a) logEvent(a, 'fuel_log_submitted', { vehicle_id: selectedVehicleId, has_receipt: !!receiptFile, currency, used_ai_autofill: extractedData !== null }); });

      // Clear form on success
      setBrand(''); setCost(''); setDistanceKmInput(''); setFuelAmountLiters('');
      setReceiptFile(null);
      setMessage({ type: 'success', text: locationData ? t('quickLog.messages.savedSuccess') : t('quickLog.messages.savedNoLocation') });

      // Haptic feedback for mobile
      if ('vibrate' in navigator) {
        window.navigator.vibrate(50);
      }

    } catch (error) {
      console.error("Error adding document: ", error);
      analytics.then(a => { if (a) logEvent(a, 'fuel_log_failed', { error_type: 'firestore_write' }); });
      setMessage({ type: 'error', text: t('quickLog.messages.saveError') });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  // --- Render Logic ---
  const messageStyle = message.type === 'error'
    ? 'text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    : message.type === 'success'
      ? 'text-green-700 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
      : 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';

  const homeCurrencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

  return (
    <div className="container mx-auto max-w-lg px-4">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 text-center">{t('quickLog.title')}</h2>

            {isLoadingVehicles ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 animate-pulse">{t('quickLog.loadingVehicles')}</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center space-y-4 mb-6">
                <div className="bg-amber-100 dark:bg-amber-800/40 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.091-1.124l-.303-4.919a1.125 1.125 0 0 0-1.121-1.056H11.25m9 4.5H16.5m-9-4.5V3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125V9.75M8.25 14.25h11.25M8.25 14.25 5.25 9.75" />
                  </svg>
                </div>
                <p className="text-amber-800 dark:text-amber-300 font-medium">{t('quickLog.noVehicles.heading')}</p>
                <p className="text-amber-700/70 dark:text-amber-400/70 text-xs">{t('quickLog.noVehicles.subtext')}</p>
                <Link to="/profile" className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-lg transition duration-150 shadow-md">
                  {t('quickLog.noVehicles.cta')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">

                {/* Section 1: Vehicle & Station */}
                <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('quickLog.sections.vehicleStation')}</h3>

                  <div>
                      <label htmlFor="vehicle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickLog.fields.vehicle')}</label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <select id="vehicle" value={selectedVehicleId} onChange={handleInputChange(setSelectedVehicleId as any)} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving}>
                        {vehicles.map((v) => ( <option key={v.id} value={v.id}>{v.name} ({v.make})</option> ))}
                      </select>
                  </div>

                  <div>
                      <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('quickLog.fields.fillingStation')} <span className="text-gray-400 font-normal text-xs">({t('quickLog.fields.fillingStationOptional')})</span>
                      </label>
                      <input type="text" id="brand" value={brand} onChange={handleInputChange(setBrand)} placeholder={t('quickLog.fields.fillingStationPlaceholder')} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving || isLoadingBrands} list="brand-suggestions" autoComplete="off" />
                      <datalist id="brand-suggestions">{knownBrands.map((b) => ( <option key={b} value={b} /> ))}</datalist>
                  </div>
                </div>

                {/* Section 2: Transaction Details */}
                <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('quickLog.sections.fuelCost')}</h3>

                  <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                          <label htmlFor="cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickLog.fields.totalCost')}</label>
                          <input type="number" inputMode="decimal" id="cost" value={cost} onChange={handleInputChange(setCost)} placeholder="0.00" step="0.01" min="0.01" required className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving} />
                      </div>
                      <div>
                          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickLog.fields.currency')}</label>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <select id="currency" value={currency} onChange={handleInputChange(setCurrency as any)} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving}>
                            {COMMON_CURRENCIES.map((curr) => ( <option key={curr.code} value={curr.code}>{curr.code}</option> ))}
                          </select>
                      </div>
                  </div>

                  {currency !== homeCurrency && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <label htmlFor="exchangeRate" className="block text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-tighter">
                          {t('quickLog.fields.exchangeRate', { currency, homeCurrency })}
                        </label>
                        {isFetchingRate && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 animate-pulse">{t('quickLog.fields.fetching')}</span>}
                      </div>
                      <input type="number" inputMode="decimal" id="exchangeRate" value={exchangeRate} onChange={handleRateChange} step="0.0001" min="0.0001" className="w-full px-3 py-2 border border-indigo-200 dark:border-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" disabled={isSaving} />
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">
                        {t('quickLog.fields.converted', { symbol: homeCurrencySymbol, amount: (parseFloat(cost || '0') * exchangeRate).toFixed(2) })}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="distance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickLog.fields.distance')}</label>
                        <input type="number" inputMode="decimal" id="distance" value={distanceKmInput} onChange={handleInputChange(setDistanceKmInput)} placeholder="0.0" step="0.1" min="0.1" required className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving} />
                    </div>
                    <div>
                        <label htmlFor="fuelAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickLog.fields.fuel')}</label>
                        <input type="number" inputMode="decimal" id="fuelAmount" value={fuelAmountLiters} onChange={handleInputChange(setFuelAmountLiters)} placeholder="0.00" step="0.01" min="0.01" required className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition duration-150" disabled={isSaving} />
                    </div>
                  </div>
                </div>

                {/* Section 3: Receipt Digitization */}
                <ReceiptAISection
                  receiptDigitizationEnabled={receiptDigitizationEnabled}
                  receiptAutoFillEnabled={receiptAutoFillEnabled}
                  receiptFile={receiptFile}
                  setReceiptFile={setReceiptFile}
                  isExtracting={isExtracting}
                  extractedData={extractedData}
                  setExtractedData={setExtractedData}
                  handleExtractData={handleExtractData}
                  handleConfirmExtraction={handleConfirmExtraction}
                  handleCancelExtraction={handleCancelExtraction}
                />

                {/* Submit Button */}
                <button type="submit" disabled={isSaving || isLoadingBrands} className="w-full inline-flex justify-center items-center py-3.5 px-4 border border-transparent shadow-lg text-base font-bold rounded-xl text-white bg-brand-primary hover:bg-brand-primary-hover focus:ring-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                    {isSaving && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {isSaving ? t(`quickLog.submit.${savingStep}`) : t('quickLog.submit.save')}
                </button>

                {/* Feedback Message */}
                {message.text && (
                  <div className={`mt-4 p-4 rounded-xl border text-sm font-medium text-center shadow-sm ${messageStyle} ${isSaving && message.type === 'info' ? 'animate-pulse' : ''}`}>
                    {message.text}
                  </div>
                )}
            </form>
            )}
        </div>
    </div>
  );
}

export default QuickLogPage;

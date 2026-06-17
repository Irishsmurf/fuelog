// src/pages/QuickLogPage.tsx
import React, { JSX, useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db, analytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';
import { useAuth } from '../context/AuthContext';
import { fetchExchangeRate, COMMON_CURRENCIES } from '../utils/currencyApi';
import { Vehicle, FuelLogData } from '../utils/types';
import { Link } from 'react-router-dom';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { uploadReceipt } from '../firebase/storageService';
import { getLastOdometerReading, getOrCreateStation, updateStationMetrics } from '../firebase/firestoreService';
import { extractDataFromReceipt, ReceiptData } from '../utils/gemini';
import { calculateDistance } from '../utils/calculations';
import { findNearestStation, isAccurateEnoughForStationMatch, GPS_ACCURACY_THRESHOLD_METERS } from '../utils/locationService';
import ReceiptAISection from '../components/ReceiptAISection';
import { useTranslation } from 'react-i18next';

// Types
type MessageType = 'success' | 'error' | 'info' | 'warning' | '';
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
  const odometerInputEnabled = getBoolean('odometerInputEnabled');

  const [brand, setBrand] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [distanceKmInput, setDistanceKmInput] = useState<string>('');
  const [odometerKmInput, setOdometerKmInput] = useState<string>('');
  const [fuelAmountLiters, setFuelAmountLiters] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingStep, setSavingStep] = useState<'locating' | 'saving'>('saving');
  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });
  const [stationWarning, setStationWarning] = useState<string>('');
  const [knownBrands, setKnownBrands] = useState<string[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState<boolean>(false);

  const homeCurrency = profile?.homeCurrency || 'EUR';

  // --- Multi-Vehicle State ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);
  const [lastOdometerReading, setLastOdometerReading] = useState<number | null>(null);

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
      const text = error instanceof Error ? error.message : t('receipt.extractionFailed');
      setMessage({ type: 'error', text });
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

  // --- Fetch Last Odometer ---
  useEffect(() => {
    if (!selectedVehicleId) {
      setLastOdometerReading(null);
      return;
    }
    const fetchLastOdometer = async () => {
      try {
        const reading = await getLastOdometerReading(selectedVehicleId);
        setLastOdometerReading(reading);
      } catch (error) {
        console.error('Error fetching last odometer reading:', error);
        setMessage({
          type: 'error',
          text: !navigator.onLine
            ? t('quickLog.messages.offline', { defaultValue: 'You are offline. Please check your connection and try again.' })
            : t('quickLog.messages.fetchOdometerError', { defaultValue: 'Failed to load last odometer reading.' }),
        });
      }
    };
    fetchLastOdometer();
  }, [selectedVehicleId]);

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

  const handleOdometerChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOdometerKmInput(e.target.value);
  };

  // Recalculate distance whenever the odometer reading or the last known
  // reading changes, so a late-arriving lastOdometerReading (e.g. slow
  // network) still auto-fills the distance instead of being silently missed.
  useEffect(() => {
    if (!odometerKmInput || lastOdometerReading === null) return;
    const parsedOdo = parseFloat(odometerKmInput);
    if (isNaN(parsedOdo)) return;
    const diff = calculateDistance(parsedOdo, lastOdometerReading);
    setDistanceKmInput(diff !== null ? diff.toFixed(1) : '');
  }, [odometerKmInput, lastOdometerReading]);

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
    const parsedOdometer = parseFloat(odometerKmInput);

    if (isNaN(parsedCost) || isNaN(parsedDistanceKm) || isNaN(parsedFuel) || parsedCost <= 0 || parsedDistanceKm <= 0 || parsedFuel <= 0) {
      setMessage({ type: 'error', text: t('quickLog.messages.validNumbers') });
      return;
    }

    setIsSaving(true);
    setSavingStep('locating');
    setStationWarning('');
    setMessage({ type: 'info', text: t('quickLog.messages.gettingLocation') });

    // --- Get Location ---
    const locationData = await getCurrentLocation();

    // --- Find Station ---
    let linkedStationId: string | undefined;
    let stationName: string | undefined;

    if (locationData) {
        if (!isAccurateEnoughForStationMatch(locationData.locationAccuracy)) {
            console.warn(
                `GPS accuracy (${locationData.locationAccuracy.toFixed(0)}m) exceeds threshold ` +
                `(${GPS_ACCURACY_THRESHOLD_METERS}m); skipping automatic station association.`
            );
            setStationWarning(t('quickLog.messages.lowAccuracySkippedStation', {
                accuracy: locationData.locationAccuracy.toFixed(0),
                defaultValue: 'GPS accuracy is low ({{accuracy}}m); skipping station detection.',
            }));
        } else {
            try {
                const nearest = await findNearestStation(locationData.latitude, locationData.longitude);
                if (nearest) {
                    linkedStationId = await getOrCreateStation(nearest);
                    stationName = nearest.name;
                    // If brand is empty, auto-fill it with station name
                    if (!brand.trim()) {
                        setBrand(nearest.name);
                    }
                }
            } catch (err) {
                console.error("Station lookup failed:", err);
            }
        }
    }

    setSavingStep('saving');
    let locationMessage: string;
    if (locationData) {
        locationMessage = stationName 
            ? t('quickLog.messages.locationCapturedAt', { station: stationName })
            : t('quickLog.messages.locationCaptured', { accuracy: locationData.locationAccuracy.toFixed(0) });
    } else if (!navigator.geolocation) {
        locationMessage = t('quickLog.messages.locationNotSupported');
    } else {
        locationMessage = t('quickLog.messages.locationNotSupported');
    }
    // --- End Get Location & Station ---

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
      const pricePerLitre = costHomeCurrency / parsedFuel;

      // Prepare data object, including location if available
      const logData: Omit<FuelLogData, 'timestamp'> & { timestamp: Timestamp; userId: string } = {
        userId: user.uid,
        vehicleId: selectedVehicleId,
        timestamp: Timestamp.now(),
        brand: brand.trim() || stationName || 'Unknown',
        cost: costHomeCurrency,
        distanceKm: parsedDistanceKm,
        fuelAmountLiters: parsedFuel,
        currency: currency,
        originalCost: parsedCost,
        exchangeRate: exchangeRate,
        receiptUrl: receiptUrl || undefined,
        stationId: linkedStationId
      };
      if (!isNaN(parsedOdometer)) {
        logData.odometerKm = parsedOdometer;
      }
      if (locationData) {
        logData.latitude = locationData.latitude;
        logData.longitude = locationData.longitude;
        logData.locationAccuracy = locationData.locationAccuracy;
      }

      // Save to Firestore
      await addDoc(collection(db, "fuelLogs"), logData);
      
      // Update station metrics if linked
      if (linkedStationId) {
        await updateStationMetrics(linkedStationId, pricePerLitre);
      }

      analytics.then(a => { if (a) logEvent(a, 'fuel_log_submitted', { vehicle_id: selectedVehicleId, has_receipt: !!receiptFile, currency, used_ai_autofill: extractedData !== null, has_station: !!linkedStationId }); });

      // Clear form on success
      setBrand(''); setCost(''); setDistanceKmInput(''); setFuelAmountLiters('');
      setOdometerKmInput('');
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
      : message.type === 'warning'
        ? 'text-yellow-700 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
        : 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';

  const homeCurrencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 bg-gray-50 dark:bg-brand-dark-surface relative overflow-hidden transition-colors duration-500">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-primary/20 dark:bg-brand-primary-glow/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[20%] right-[-10%] w-80 h-80 bg-amber-400/20 dark:bg-amber-500/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[80px] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }}></div>
      
      <div className="container mx-auto max-w-lg relative z-10">
        <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10 transition-all duration-500 hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)]">
          
          <div className="flex flex-col items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/30 rotate-3 transform transition-transform hover:rotate-6 hover:scale-110 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white transform -rotate-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight text-center">
              {t('quickLog.title')}
            </h2>
          </div>

          {isLoadingVehicles ? (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20 dark:border-brand-primary-glow/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-brand-primary dark:border-brand-primary-glow border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">{t('quickLog.loadingVehicles')}</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="bg-amber-50/80 dark:bg-amber-900/10 backdrop-blur-sm border border-amber-200/50 dark:border-amber-500/20 rounded-2xl p-8 text-center space-y-5 mb-6 transition-transform hover:scale-[1.02] duration-300">
              <div className="bg-white dark:bg-gray-800 shadow-md w-16 h-16 rounded-full flex items-center justify-center mx-auto text-amber-500 dark:text-amber-400 ring-4 ring-amber-50 dark:ring-amber-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 animate-bounce" style={{ animationDuration: '2s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.091-1.124l-.303-4.919a1.125 1.125 0 0 0-1.121-1.056H11.25m9 4.5H16.5m-9-4.5V3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125V9.75M8.25 14.25h11.25M8.25 14.25 5.25 9.75" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-amber-900 dark:text-amber-300 font-bold text-lg tracking-tight">{t('quickLog.noVehicles.heading')}</p>
                <p className="text-amber-700/80 dark:text-amber-400/80 text-sm">{t('quickLog.noVehicles.subtext')}</p>
              </div>
              <Link to="/profile" className="block w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:-translate-y-0.5 active:translate-y-0">
                {t('quickLog.noVehicles.cta')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">

              {/* Section 1: Vehicle & Station */}
              <div className="group bg-white/40 dark:bg-white/[0.02] p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('quickLog.sections.vehicleStation')}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="vehicle" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('quickLog.fields.vehicle')}</label>
                    <div className="relative">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <select id="vehicle" value={selectedVehicleId} onChange={handleInputChange(setSelectedVehicleId as any)} className="w-full px-4 py-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:focus:ring-brand-primary-glow/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 appearance-none font-medium cursor-pointer" disabled={isSaving}>
                        {vehicles.map((v) => ( <option key={v.id} value={v.id}>{v.name} ({v.make})</option> ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="brand" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                      <span>{t('quickLog.fields.fillingStation')}</span>
                      <span className="text-gray-400 font-normal text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{t('quickLog.fields.fillingStationOptional')}</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <input type="text" id="brand" value={brand} onChange={handleInputChange(setBrand)} placeholder={t('quickLog.fields.fillingStationPlaceholder')} className="w-full pl-10 pr-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:focus:ring-brand-primary-glow/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 placeholder-gray-400 font-medium" disabled={isSaving || isLoadingBrands} list="brand-suggestions" autoComplete="off" />
                    </div>
                    <datalist id="brand-suggestions">{knownBrands.map((b) => ( <option key={b} value={b} /> ))}</datalist>
                  </div>
                </div>
              </div>

              {/* Section 2: Transaction Details */}
              <div className="group bg-white/40 dark:bg-white/[0.02] p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-amber-400 rounded-full"></div>
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('quickLog.sections.fuelCost')}</h3>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-3">
                      <label htmlFor="cost" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('quickLog.fields.totalCost')}</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <span className="text-gray-500 dark:text-gray-400 font-medium">{homeCurrencySymbol}</span>
                        </div>
                        <input type="number" inputMode="decimal" id="cost" value={cost} onChange={handleInputChange(setCost)} placeholder="0.00" step="0.01" min="0.01" required className="w-full pl-8 pr-4 py-3 text-lg bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 fuel-numeral font-bold placeholder-gray-300 dark:placeholder-gray-600" disabled={isSaving} />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="currency" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('quickLog.fields.currency')}</label>
                      <div className="relative">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <select id="currency" value={currency} onChange={handleInputChange(setCurrency as any)} className="w-full px-3 py-3.5 text-sm bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 appearance-none font-semibold cursor-pointer" disabled={isSaving}>
                          {COMMON_CURRENCIES.map((curr) => ( <option key={curr.code} value={curr.code}>{curr.code}</option> ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {currency !== homeCurrency && (
                    <div className="bg-gradient-to-r from-brand-primary/5 to-amber-400/5 dark:from-brand-primary/10 dark:to-amber-500/10 p-4 rounded-xl border border-brand-primary/20 dark:border-brand-primary/30 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/10 rounded-full filter blur-xl transform translate-x-1/2 -translate-y-1/2"></div>
                      <div className="flex justify-between items-center relative z-10">
                        <label htmlFor="exchangeRate" className="block text-xs font-bold text-brand-primary-hover dark:text-brand-primary-glow uppercase tracking-wider">
                          {t('quickLog.fields.exchangeRate', { currency, homeCurrency })}
                        </label>
                        {isFetchingRate && <span className="text-[10px] bg-brand-primary/10 text-brand-primary dark:text-brand-primary-glow px-2 py-0.5 rounded-full animate-pulse">{t('quickLog.fields.fetching')}</span>}
                      </div>
                      <div className="relative z-10">
                        <input type="number" inputMode="decimal" id="exchangeRate" value={exchangeRate} onChange={handleRateChange} step="0.0001" min="0.0001" className="w-full px-4 py-2.5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-brand-primary/30 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900 dark:text-gray-100 text-sm fuel-numeral font-medium transition-all duration-300" disabled={isSaving} />
                      </div>
                      <p className="text-xs text-brand-primary-hover dark:text-brand-primary-glow font-bold relative z-10 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        {t('quickLog.fields.converted', { symbol: homeCurrencySymbol, amount: (parseFloat(cost || '0') * exchangeRate).toFixed(2) })}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {odometerInputEnabled && (
                      <div className="group/input">
                        <label htmlFor="odometer" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-widest">{t('quickLog.fields.odometer')}</label>
                        <div className="relative">
                          <input type="number" inputMode="decimal" id="odometer" value={odometerKmInput} onChange={handleOdometerChange} placeholder="0" step="1" min="0" className="w-full px-3 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 text-sm transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 fuel-numeral font-bold group-hover/input:border-gray-300 dark:group-hover/input:border-gray-600" disabled={isSaving} />
                        </div>
                      </div>
                    )}
                    <div className={odometerInputEnabled ? "group/input" : "col-span-2 group/input"}>
                      <label htmlFor="distance" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-widest">{t('quickLog.fields.distance')}</label>
                      <div className="relative">
                        <input type="number" inputMode="decimal" id="distance" value={distanceKmInput} onChange={handleInputChange(setDistanceKmInput)} placeholder="0.0" step="0.1" min="0.1" required className="w-full px-3 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 text-sm transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 fuel-numeral font-bold group-hover/input:border-gray-300 dark:group-hover/input:border-gray-600" disabled={isSaving} />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">km</span>
                        </div>
                      </div>
                    </div>
                    <div className="group/input">
                      <label htmlFor="fuelAmount" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-widest">{t('quickLog.fields.fuel')}</label>
                      <div className="relative">
                        <input type="number" inputMode="decimal" id="fuelAmount" value={fuelAmountLiters} onChange={handleInputChange(setFuelAmountLiters)} placeholder="0.00" step="0.01" min="0.01" required className="w-full px-3 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-gray-900 dark:text-gray-100 text-sm transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 fuel-numeral font-bold group-hover/input:border-gray-300 dark:group-hover/input:border-gray-600" disabled={isSaving} />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">L</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {odometerInputEnabled && odometerKmInput && (
                    <div className="mt-2 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700/50">
                      {lastOdometerReading === null ? (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                          {t('quickLog.fields.odometerHintBaseline')}
                        </p>
                      ) : (
                        <p className={`text-[11px] font-medium flex items-center gap-1.5 ${parseFloat(odometerKmInput) < lastOdometerReading ? 'text-red-500' : 'text-brand-primary dark:text-brand-primary-glow'}`}>
                          {parseFloat(odometerKmInput) < lastOdometerReading ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          )}
                          {parseFloat(odometerKmInput) < lastOdometerReading 
                            ? t('quickLog.fields.odometerErrorLower', { last: lastOdometerReading })
                            : t('quickLog.fields.odometerHintCalculating', { last: lastOdometerReading })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Receipt Digitization */}
              <div className="transform transition-all duration-300 hover:-translate-y-0.5">
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
              </div>

              {/* Submit Button */}
              <div className="pt-2 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-amber-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <button type="submit" disabled={isSaving || isLoadingBrands} className="relative w-full brand-button-primary py-4 text-lg font-bold rounded-2xl overflow-hidden shadow-xl shadow-brand-primary/20 hover:shadow-brand-primary/40 transform transition-all active:scale-[0.98]">
                    <span className={`flex items-center justify-center gap-2 ${isSaving ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      {t('quickLog.submit.save')}
                    </span>
                    {isSaving && (
                      <span className="absolute inset-0 flex items-center justify-center gap-2 text-gray-950">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {t(`quickLog.submit.${savingStep}`)}
                      </span>
                    )}
                </button>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {stationWarning && (
                  <div className="p-4 rounded-2xl border text-sm font-medium flex items-start gap-3 shadow-sm text-yellow-800 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800/50 animate-[squish_0.3s_ease-out]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    <span>{stationWarning}</span>
                  </div>
                )}

                {message.text && (
                  <div className={`p-4 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 shadow-sm animate-[squish_0.3s_ease-out] ${messageStyle} ${isSaving && message.type === 'info' ? 'animate-pulse' : ''}`}>
                    {message.type === 'success' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                    {message.type === 'error' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>}
                    <span>{message.text}</span>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuickLogPage;


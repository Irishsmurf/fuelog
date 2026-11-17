// Quick Log save flow: validate, resolve location + station, upload the
// receipt, then add the log through the data layer.
import { FormEvent, useState } from 'react';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import type { TFunction } from 'i18next';
import { analytics } from '../firebase/config';
import { uploadReceipt } from '../firebase/storageService';
import { getOrCreateStation } from '../firebase/firestoreService';
import { useAddLog } from '../data/logHooks';
import type { NewFuelLog } from '../data/logs';
import { findNearestStation, isAccurateEnoughForStationMatch, type OSMStation } from '../utils/locationService';
import { getCurrentLocation } from '../utils/geolocation';
import type { LocationData, SetMessage } from '../components/quicklog/types';
import type { QuickLogFields } from './useQuickLogFields';
import type { ExchangeRateState } from './useExchangeRate';
import type { LocationPinState } from './useLocationPin';
import type { ReceiptExtractionState } from './useReceiptExtraction';

interface Options {
  user: User | null;
  hasVehicles: boolean;
  vehicleId: string;
  fields: QuickLogFields;
  rate: ExchangeRateState;
  pin: LocationPinState;
  receipt: ReceiptExtractionState;
  setMessage: SetMessage;
  setStationWarning: (text: string) => void;
  t: TFunction;
}

const track = (event: string, params: Record<string, unknown>) =>
  analytics.then(a => { if (a) logEvent(a, event, params); });

/** Creates/links the station document for an OSM station. */
async function linkStation(nearest: OSMStation | null) {
  if (!nearest) return null;
  return { id: await getOrCreateStation(nearest), name: nearest.name };
}

export function useQuickLogSubmit(o: Options) {
  const { user, fields, rate, pin, receipt, setMessage, setStationWarning, t } = o;
  const addLog = useAddLog(user?.uid);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingStep, setSavingStep] = useState<'locating' | 'saving'>('saving');

  /** Validates the form; returns the parsed values or null after reporting an error. */
  const validate = () => {
    const fail = (text: string) => { setMessage({ type: 'error', text }); return null; };
    if (!user) return fail(t('quickLog.messages.mustBeLoggedIn'));
    if (!o.hasVehicles) return fail(t('quickLog.messages.addVehicleFirst'));
    if (!o.vehicleId) return fail(t('quickLog.messages.selectVehicle'));
    if (!fields.cost || !fields.distanceKm || !fields.fuelAmountLiters) return fail(t('quickLog.messages.fillRequired'));

    const cost = parseFloat(fields.cost);
    const distanceKm = parseFloat(fields.distanceKm);
    const fuel = parseFloat(fields.fuelAmountLiters);
    if (isNaN(cost) || isNaN(distanceKm) || isNaN(fuel) || cost <= 0 || distanceKm <= 0 || fuel <= 0) {
      return fail(t('quickLog.messages.validNumbers'));
    }
    const loggedDate = new Date(fields.loggedAt);
    if (isNaN(loggedDate.getTime())) {
      return fail(t('quickLog.messages.invalidDate', { defaultValue: 'Please enter a valid date and time.' }));
    }
    if (loggedDate.getTime() > Date.now() + 60_000) {
      return fail(t('quickLog.messages.futureDate', { defaultValue: 'The fuelling date/time cannot be in the future.' }));
    }
    return { user, cost, distanceKm, fuel, odometer: parseFloat(fields.odometerKm), loggedDate };
  };

  /**
   * Manual pin: the user explicitly chose where they fuelled, use it as-is
   * (no GPS accuracy gate). GPS mode: a fresh fix at submit time, the fast
   * at-pump path. Station problems are non-fatal and reported as warnings.
   */
  const resolveLocation = async (saveWarnings: string[]) => {
    let locationData: LocationData | null = null;
    let station: { id: string; name: string } | null = null;
    if (pin.locationMode === 'manual' && pin.location) {
      locationData = pin.location;
      try {
        station = await linkStation(pin.matchedStation ?? await findNearestStation(locationData.latitude, locationData.longitude));
      } catch (err) {
        console.error("Station lookup failed:", err);
        saveWarnings.push(t('quickLog.messages.stationLookupWarning'));
      }
    } else {
      setSavingStep('locating');
      setMessage({ type: 'info', text: t('quickLog.messages.gettingLocation') });
      locationData = await getCurrentLocation();
      if (locationData) {
        const accuracy = locationData.locationAccuracy ?? Infinity;
        if (!isAccurateEnoughForStationMatch(accuracy)) {
          setStationWarning(t('quickLog.messages.lowAccuracySkippedStation', {
            accuracy: accuracy.toFixed(0),
            defaultValue: 'GPS accuracy is low ({{accuracy}}m); skipping station detection.',
          }));
        } else {
          try {
            station = await linkStation(await findNearestStation(locationData.latitude, locationData.longitude));
          } catch (err) {
            console.error("Station lookup failed:", err);
            setStationWarning(t('quickLog.messages.stationLookupWarning'));
          }
        }
      }
    }
    if (station && !fields.brand.trim()) fields.setBrand(station.name);
    return { locationData, station };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = validate();
    if (!v) return;

    setIsSaving(true);
    setStationWarning('');
    // Non-fatal problems collected during save (e.g. receipt upload or station
    // linking failed). They don't block saving the log; the user is told.
    const saveWarnings: string[] = [];
    const { locationData, station } = await resolveLocation(saveWarnings);

    setSavingStep('saving');
    const locationMessage = locationData
      ? (station
        ? t('quickLog.messages.locationCapturedAt', { station: station.name })
        : t('quickLog.messages.locationSet', { defaultValue: 'Location set.' }))
      : t('quickLog.messages.locationNotSupported');
    setMessage({ type: 'info', text: t('quickLog.messages.savingLog', { locationMsg: locationMessage }) });

    try {
      let receiptUrl = "";
      if (receipt.receiptFile) {
        setMessage({ type: 'info', text: t('quickLog.messages.uploadingReceipt') });
        try {
          receiptUrl = await uploadReceipt(receipt.receiptFile, v.user.uid);
        } catch (uploadError) {
          console.error("Receipt upload failed: ", uploadError);
          track('fuel_log_failed', { error_type: 'receipt_upload' });
          saveWarnings.push(t('quickLog.messages.receiptUploadWarning'));
        }
      }

      // Optional fields are omitted, never undefined: Firestore rejects undefined.
      const logData: NewFuelLog = {
        userId: v.user.uid,
        vehicleId: o.vehicleId,
        timestamp: Timestamp.fromDate(v.loggedDate),
        brand: fields.brand.trim() || station?.name || 'Unknown',
        cost: v.cost * rate.exchangeRate, // home currency
        distanceKm: v.distanceKm,
        fuelAmountLiters: v.fuel,
        currency: rate.currency,
        originalCost: v.cost,
        exchangeRate: rate.exchangeRate,
      };
      if (receiptUrl) logData.receiptUrl = receiptUrl;
      if (station) logData.stationId = station.id;
      if (!isNaN(v.odometer)) logData.odometerKm = v.odometer;
      if (locationData) {
        logData.latitude = locationData.latitude;
        logData.longitude = locationData.longitude;
        // Manual pins have no accuracy figure — only store it for GPS fixes.
        if (locationData.locationAccuracy !== undefined) logData.locationAccuracy = locationData.locationAccuracy;
      }

      // The only fatal step. Offline it resolves at once (the write is queued).
      const { savedOffline } = await addLog.mutateAsync(logData);

      track('fuel_log_submitted', { vehicle_id: o.vehicleId, has_receipt: !!receipt.receiptFile, currency: rate.currency, used_ai_autofill: receipt.extractedData !== null, has_station: !!station });

      fields.reset();
      receipt.setReceiptFile(null);
      pin.reset();
      rate.clearManualRate();
      if (savedOffline) {
        saveWarnings.unshift(t('quickLog.messages.savedOffline', { defaultValue: "You're offline: it will sync when you're back online." }));
      }
      const base = locationData ? t('quickLog.messages.savedSuccess') : t('quickLog.messages.savedNoLocation');
      setMessage(saveWarnings.length > 0
        ? { type: 'warning', text: `${base} ${saveWarnings.join(' ')}` }
        : { type: 'success', text: base });

      // Haptic feedback for mobile
      if ('vibrate' in navigator) window.navigator.vibrate(50);
    } catch (error) {
      console.error("Error adding document: ", error);
      track('fuel_log_failed', { error_type: 'firestore_write' });
      setMessage({
        type: 'error',
        text: t('quickLog.messages.saveError', { detail: error instanceof Error ? error.message : String(error) }),
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setMessage({ type: '', text: '' });
        setStationWarning('');
      }, 5000);
    }
  };

  return { handleSubmit, isSaving, savingStep };
}

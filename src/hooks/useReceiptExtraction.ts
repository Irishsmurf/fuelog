// Receipt photo + AI extraction, and applying the extracted values to the form.
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { extractDataFromReceipt, type ReceiptData } from '../utils/gemini';
import { geocodeAddress } from '../utils/locationService';
import { toDatetimeLocal } from '../utils/formatDate';
import type { SetMessage } from '../components/quicklog/types';
import type { QuickLogFields } from './useQuickLogFields';
import type { LocationPinState } from './useLocationPin';

interface Options {
  fields: QuickLogFields;
  pin: LocationPinState;
  setMessage: SetMessage;
  t: TFunction;
}

/** The receipt's printed date/time as a datetime-local value, or null. */
export function receiptDateTime(data: ReceiptData): string | null {
  if (!data.purchaseDate) return null;
  const parsed = new Date(`${data.purchaseDate}T${data.purchaseTime || '12:00'}`);
  return isNaN(parsed.getTime()) ? null : toDatetimeLocal(parsed);
}

export function useReceiptExtraction({ fields, pin, setMessage, t }: Options) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ReceiptData | null>(null);

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

  const handleConfirmExtraction = () => {
    if (!extractedData) return;
    if (extractedData.cost != null) fields.setCost(extractedData.cost.toString());
    if (extractedData.fuelAmountLiters != null) fields.setFuelAmountLiters(extractedData.fuelAmountLiters.toString());
    if (extractedData.brand != null) fields.setBrand(extractedData.brand);

    // Apply the receipt's printed date/time so a late entry is dated to the
    // actual fuelling, not when it was logged.
    const dateTime = receiptDateTime(extractedData);
    if (dateTime) fields.setLoggedAt(dateTime);

    // Best-effort: geocode the receipt's printed address to default the map
    // pin near the station. Only a specific address — geocoding a bare brand
    // ("Shell") would resolve to a random matching location worldwide.
    if (extractedData.address) {
      geocodeAddress(extractedData.address).then(coords => { if (coords) pin.pinAndShow(coords); });
    }

    setExtractedData(null);
    setMessage({ type: 'success', text: t('receipt.autoFilled') });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleCancelExtraction = () => setExtractedData(null);

  return {
    receiptFile, setReceiptFile, isExtracting, extractedData, setExtractedData,
    handleExtractData, handleConfirmExtraction, handleCancelExtraction,
  };
}

export type ReceiptExtractionState = ReturnType<typeof useReceiptExtraction>;

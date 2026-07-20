import React from 'react';
import { Sparkles } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { ReceiptData } from '../utils/gemini';
import { useTranslation } from 'react-i18next';

interface ReceiptAISectionProps {
  receiptDigitizationEnabled: boolean;
  receiptAutoFillEnabled: boolean;
  receiptFile: File | null;
  setReceiptFile: (file: File | null) => void;
  isExtracting: boolean;
  extractedData: ReceiptData | null;
  setExtractedData: React.Dispatch<React.SetStateAction<ReceiptData | null>>;
  handleExtractData: () => void;
  handleConfirmExtraction: () => void;
  handleCancelExtraction: () => void;
}

const ReceiptAISection: React.FC<ReceiptAISectionProps> = ({
  receiptDigitizationEnabled,
  receiptAutoFillEnabled,
  receiptFile,
  setReceiptFile,
  isExtracting,
  extractedData,
  setExtractedData,
  handleExtractData,
  handleConfirmExtraction,
  handleCancelExtraction,
}) => {
  const { t } = useTranslation();

  if (!receiptDigitizationEnabled) return null;

  return (
    <div className="border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 bg-brand-primary/[0.04] p-4 rounded-xl space-y-4">
      <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0">{t('quickLog.sections.receipt')}</h3>
      <ImageUpload
        onFileSelect={(file) => {
          setReceiptFile(file);
          setExtractedData(null); // Reset extracted data on new file
        }}
      />

      {receiptAutoFillEnabled && receiptFile && (
        <div className="mt-4">
          {!extractedData ? (
            <button
              type="button"
              onClick={handleExtractData}
              disabled={isExtracting}
              className="brand-button-primary w-full text-sm"
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('receipt.analyzing')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('receipt.autoFillWithAI')}
                </>
              )}
            </button>
          ) : (
            <div className="nocturne-card p-3 text-sm">
              <div className="mb-2"><span className="nocturne-tag">{t('receipt.extractionResults')}</span></div>
              <ul className="space-y-1 mb-3 text-gray-600 dark:text-gray-400">
                <li><span className="font-medium">{t('receipt.cost')}:</span> {extractedData.cost !== null ? extractedData.cost : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.litres')}:</span> {extractedData.fuelAmountLiters !== null ? extractedData.fuelAmountLiters : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.brand')}:</span> {extractedData.brand !== null ? extractedData.brand : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.date', { defaultValue: 'Date' })}:</span> {extractedData.purchaseDate !== null ? `${extractedData.purchaseDate}${extractedData.purchaseTime ? ` ${extractedData.purchaseTime}` : ''}` : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.location', { defaultValue: 'Location' })}:</span> {extractedData.address !== null ? extractedData.address : t('receipt.notFound')}</li>
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmExtraction}
                  className="brand-button-primary flex-1 py-1.5 text-sm"
                >
                  {t('receipt.useValues')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelExtraction}
                  className="brand-button-secondary flex-1 py-1.5 text-sm"
                >
                  {t('receipt.discard')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceiptAISection;

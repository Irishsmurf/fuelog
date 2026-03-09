import React from 'react';
import { Sparkles } from 'lucide-react';
import ImageUpload from './ImageUpload';
import Spinner from './Spinner';
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
    <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
      <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('quickLog.sections.receipt')}</h3>
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
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Spinner />
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
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm text-sm">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('receipt.extractionResults')}</p>
              <ul className="space-y-1 mb-3 text-gray-600 dark:text-gray-400">
                <li><span className="font-medium">{t('receipt.cost')}:</span> {extractedData.cost !== null ? extractedData.cost : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.litres')}:</span> {extractedData.fuelAmountLiters !== null ? extractedData.fuelAmountLiters : t('receipt.notFound')}</li>
                <li><span className="font-medium">{t('receipt.brand')}:</span> {extractedData.brand !== null ? extractedData.brand : t('receipt.notFound')}</li>
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmExtraction}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
                >
                  {t('receipt.useValues')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelExtraction}
                  className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-medium transition-colors"
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

import { useState } from 'react';
import { extractDataFromReceipt, ReceiptData } from '../utils/gemini';

interface MessageState {
  type: 'success' | 'error' | 'info' | '';
  text: string;
}

interface UseReceiptAIOptions {
  onConfirm: (data: ReceiptData) => void;
  setMessage: (msg: MessageState) => void;
}

export function useReceiptAI({ onConfirm, setMessage }: UseReceiptAIOptions) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ReceiptData | null>(null);

  const handleExtractData = async () => {
    if (!receiptFile) return;
    setIsExtracting(true);
    setExtractedData(null);
    setMessage({ type: 'info', text: 'Analyzing receipt with AI...' });
    try {
      const data = await extractDataFromReceipt(receiptFile);
      setExtractedData(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Extraction error:', error);
      setMessage({ type: 'error', text: 'Failed to extract data from receipt.' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmExtraction = () => {
    if (extractedData) {
      onConfirm(extractedData);
      setExtractedData(null);
      setMessage({ type: 'success', text: 'Fields auto-filled from receipt!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleCancelExtraction = () => {
    setExtractedData(null);
  };

  return {
    receiptFile,
    setReceiptFile,
    isExtracting,
    extractedData,
    setExtractedData,
    handleExtractData,
    handleConfirmExtraction,
    handleCancelExtraction,
  };
}

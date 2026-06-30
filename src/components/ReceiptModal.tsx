// src/components/ReceiptModal.tsx
import { JSX, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sanitizeUrl } from '../utils/sanitize';

interface ReceiptModalProps {
  url: string;
  onClose: () => void;
}

function ReceiptModal({ url, onClose }: ReceiptModalProps): JSX.Element {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('logCard.receipt')}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title={t('logCard.closeReceipt', { defaultValue: 'Close' })}
        aria-label={t('logCard.closeReceipt', { defaultValue: 'Close' })}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={24} />
      </button>
      <img
        src={sanitizeUrl(url)}
        alt={t('logCard.receipt')}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default ReceiptModal;

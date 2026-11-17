import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

/** Explains how distance is derived from the odometer, or flags a lower reading. */
export default function OdometerHint({ odometerKm, lastReading }: { odometerKm: string; lastReading: number | null }): JSX.Element {
  const { t } = useTranslation();
  if (lastReading === null) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
        {t('quickLog.fields.odometerHintBaseline')}
      </p>
    );
  }
  const lower = parseFloat(odometerKm) < lastReading;
  return (
    <p className={`text-[11px] font-medium flex items-center gap-1.5 ${lower ? 'text-red-500' : 'text-brand-primary dark:text-brand-primary-glow'}`}>
      {lower ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      )}
      {lower
        ? t('quickLog.fields.odometerErrorLower', { last: lastReading })
        : t('quickLog.fields.odometerHintCalculating', { last: lastReading })}
    </p>
  );
}

// Save button plus the station-warning and status banners below it.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageState } from './types';

interface Props {
  isSaving: boolean;
  disabled: boolean;
  savingStep: 'locating' | 'saving';
  stationWarning: string;
  message: MessageState;
}

const MESSAGE_STYLES: Record<string, string> = {
  error: 'text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  success: 'text-green-700 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  warning: 'text-yellow-700 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  info: 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
};

export default function SaveControls({ isSaving, disabled, savingStep, stationWarning, message }: Props): JSX.Element {
  const { t } = useTranslation();
  const messageStyle = MESSAGE_STYLES[message.type] ?? MESSAGE_STYLES.info;

  return (
    <>
      <div className="pt-2 relative">
        <button type="submit" disabled={disabled} className="relative w-full brand-button-primary py-3 text-base">
          <span className={`flex items-center justify-center gap-2 ${isSaving ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            {t('quickLog.submit.save')}
          </span>
          {isSaving && (
            <span className="absolute inset-0 flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {t(`quickLog.submit.${savingStep}`)}
            </span>
          )}
        </button>
      </div>

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
    </>
  );
}

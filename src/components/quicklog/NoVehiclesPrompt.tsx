import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LoadingVehicles(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12 flex flex-col items-center">
      <div className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-brand-primary animate-spin"></div>
      <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">{t('quickLog.loadingVehicles')}</p>
    </div>
  );
}

/** Shown instead of the form until the user has an active vehicle. */
export default function NoVehiclesPrompt(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 bg-brand-primary/[0.04] rounded-xl p-8 text-center space-y-5 mb-6">
      <div className="bg-white dark:bg-gray-800 w-14 h-14 rounded-lg flex items-center justify-center mx-auto text-amber-600 dark:text-amber-300 border border-gray-200 dark:border-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.091-1.124l-.303-4.919a1.125 1.125 0 0 0-1.121-1.056H11.25m9 4.5H16.5m-9-4.5V3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125V9.75M8.25 14.25h11.25M8.25 14.25 5.25 9.75" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-gray-900 dark:text-gray-100 font-medium text-lg tracking-tight">{t('quickLog.noVehicles.heading')}</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('quickLog.noVehicles.subtext')}</p>
      </div>
      <Link to="/profile" className="brand-button-primary w-full">
        {t('quickLog.noVehicles.cta')}
      </Link>
    </div>
  );
}

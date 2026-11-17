// Weekly digest push-notification toggle.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff } from 'lucide-react';
import { useFCMToken } from '../../hooks/useFCMToken';

export default function NotificationsSection(): JSX.Element {
  const { t } = useTranslation();
  const { isEnabled, isLoading, permissionDenied, enable, disable } = useFCMToken();

  return (
    <div className="nocturne-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-yellow-500" />
        </div>
        <h3 className="text-xl font-medium tracking-tight">{t('profile.notifications.heading', { defaultValue: 'Notifications' })}</h3>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{t('profile.notifications.weeklyDigest', { defaultValue: 'Weekly fuel digest' })}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.notifications.weeklyDigestDesc', { defaultValue: 'Push notification every Monday with your weekly fuel summary.' })}</p>
        </div>
        <button
          onClick={isEnabled ? disable : enable}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isEnabled
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {isEnabled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isEnabled
            ? t('profile.notifications.disable', { defaultValue: 'Disable' })
            : t('profile.notifications.enable', { defaultValue: 'Enable' })}
        </button>
      </div>
      {permissionDenied && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {t('profile.notifications.permissionDenied', { defaultValue: 'Notifications are blocked for this site in your browser settings. Enable them in your browser\'s site permissions, then try again.' })}
        </p>
      )}
    </div>
  );
}

// One-off maintenance: link existing logs to station documents.
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { migrateUserLogsToStations } from '../../utils/migrationService';
import StatusBanner, { type StatusMessage } from './StatusBanner';

export default function MaintenanceSection(): JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const handleMigrateStations = async () => {
    if (!user) return;
    setIsMigrating(true);
    setMessage(null);
    setProgress({ current: 0, total: 0 });
    try {
      const result = await migrateUserLogsToStations(user.uid, (current, total) => {
        setProgress({ current, total });
      });
      setMessage({ type: 'success', text: t('profile.maintenance.migrationSuccess', { count: result.migrated }) });
    } catch (err) {
      console.error("Migration error:", err);
      setMessage({ type: 'error', text: t('profile.maintenance.migrationError') });
    } finally {
      setIsMigrating(false);
      setProgress(null);
    }
  };

  const percent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="nocturne-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500">
          <RefreshCw size={20} />
        </div>
        <h3 className="text-xl font-medium tracking-tight">{t('profile.maintenance.heading')}</h3>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">{t('profile.maintenance.migrateStations')}</h4>
          <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-md">
            {t('profile.maintenance.migrateStationsDesc')}
          </p>
        </div>
        {!isMigrating ? (
          <button onClick={handleMigrateStations} className="brand-button-primary px-6 py-3 text-sm">
            <RefreshCw size={16} />
            <span>{t('profile.maintenance.migrateStationsButton')}</span>
          </button>
        ) : (
          <div className="w-full md:w-48 space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>{t('profile.maintenance.migrating')}</span>
              <span>{progress ? Math.round(percent) : 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-brand-primary transition-all duration-300 ease-out" style={{ width: `${percent}%` }}></div>
            </div>
            <p className="text-[10px] text-gray-400 text-center font-bold">
              {progress?.current} / {progress?.total}
            </p>
          </div>
        )}
      </div>

      {message && <StatusBanner message={message} />}
    </div>
  );
}

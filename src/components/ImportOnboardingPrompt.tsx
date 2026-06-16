import { JSX } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UploadCloud, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * One-time banner nudging new users toward the CSV import flow (#154).
 * Shown until the user dismisses it or follows the import link; persisted
 * via `hasSeenImportOnboarding` on the user's profile so it never reappears.
 */
function ImportOnboardingPrompt(): JSX.Element | null {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();

  if (!profile || profile.hasSeenImportOnboarding) return null;

  const dismiss = () => {
    updateProfile({ hasSeenImportOnboarding: true }).catch((error) => {
      console.error('Failed to persist import onboarding dismissal:', error);
    });
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6 flex items-start gap-3">
      <UploadCloud size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
      <div className="flex-grow">
        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{t('importOnboarding.heading')}</p>
        <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1">{t('importOnboarding.description')}</p>
        <Link
          to="/import"
          onClick={dismiss}
          className="inline-block mt-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          {t('importOnboarding.cta')}
        </Link>
      </div>
      <button
        onClick={dismiss}
        aria-label={t('importOnboarding.dismiss')}
        className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default ImportOnboardingPrompt;

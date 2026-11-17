import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';

export default function DataImportSection(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="nocturne-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-indigo-500" />
        </div>
        <h3 className="text-xl font-medium tracking-tight">{t('profile.dataImport.heading')}</h3>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{t('profile.dataImport.description')}</p>
        <Link
          to="/import"
          className="brand-button-primary px-4 py-2 text-sm shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          {t('profile.dataImport.cta')}
        </Link>
      </div>
    </div>
  );
}

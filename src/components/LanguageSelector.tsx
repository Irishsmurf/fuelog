import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ga', label: 'Gaeilge' },
];

function LanguageSelector(): JSX.Element {
  const { i18n, t } = useTranslation();

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <div className="flex items-center gap-2">
      <Languages size={16} className="text-gray-400 shrink-0" />
      <select
        value={i18n.language.startsWith('ga') ? 'ga' : 'en'}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t('language.label')}
        className="text-xs font-bold bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 cursor-pointer pr-1"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelector;

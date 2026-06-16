import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { BASE_LANGUAGES, PSEUDOLOCALE } from '../i18n/languages';

const LANGUAGES =
  import.meta.env.VITE_ENABLE_PSEUDOLOCALE === 'true'
    ? [...BASE_LANGUAGES, PSEUDOLOCALE]
    : BASE_LANGUAGES;

interface LanguageSelectorProps {
  /**
   * Native <select> elements always render the selected <option>'s full
   * text in the closed state — CSS truncation doesn't apply to that box in
   * any browser. When `compact` is set, the option text is the language
   * code (e.g. "EN") instead of the full label, so the control stays small
   * in space-constrained contexts like the app header.
   */
  compact?: boolean;
}

function LanguageSelector({ compact = false }: LanguageSelectorProps): JSX.Element {
  const { i18n, t } = useTranslation();

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <div className="flex items-center gap-2">
      <Languages size={16} className="text-gray-400 shrink-0" />
      <select
        value={
          (
            LANGUAGES.find(lang => i18n.language === lang.code) ??
            LANGUAGES.find(lang => i18n.language.startsWith(lang.code)) ??
            LANGUAGES[0]
          ).code
        }
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t('language.label')}
        className="text-xs font-bold bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 cursor-pointer pr-1"
      >
        {LANGUAGES.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            className="bg-white dark:bg-brand-dark-surface text-gray-900 dark:text-gray-100"
          >
            {compact ? lang.code.toUpperCase() : lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelector;

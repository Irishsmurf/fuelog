import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import type { BackendModule, ResourceKey } from 'i18next';
import en from './locales/en.json';
import { BASE_LANGUAGES, PSEUDOLOCALE } from './languages';
import { pseudolocalizeResources } from './pseudolocalize';

// English is the fallback and ships in the entry chunk; every other locale is
// its own chunk, fetched only when that language is detected or chosen.
const localeLoaders = import.meta.glob<{ default: ResourceKey }>([
  './locales/*.json',
  '!./locales/en.json',
]);

const lazyLocales: BackendModule = {
  type: 'backend',
  init: () => {},
  read(language, _namespace, callback) {
    const load = localeLoaders[`./locales/${language}.json`];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (mod) => callback(null, mod.default),
      (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), false),
    );
  },
};

const isPseudolocaleEnabled = import.meta.env.VITE_ENABLE_PSEUDOLOCALE === 'true';

const supportedLngs = BASE_LANGUAGES.map(lang => lang.code);
if (isPseudolocaleEnabled) supportedLngs.push(PSEUDOLOCALE.code);

/** Resolves once the detected language is loaded (or failed and fell back to English). */
export const i18nReady = i18n
  .use(lazyLocales)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ...(isPseudolocaleEnabled && {
        [PSEUDOLOCALE.code]: { translation: pseudolocalizeResources(en) },
      }),
    },
    // Resources above are only a partial set; the backend loads the rest.
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'fuelog_language',
    },
    interpolation: {
      escapeValue: false,
    },
    // The first render waits for i18nReady (main.tsx), and changeLanguage loads
    // a locale before switching, so components never need to suspend.
    react: { useSuspense: false },
  })
  .then(
    () => undefined,
    () => undefined,
  );

export default i18n;

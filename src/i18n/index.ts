import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ga from './locales/ga.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import { pseudolocalizeResources } from './pseudolocalize';

const isPseudolocaleEnabled = import.meta.env.VITE_ENABLE_PSEUDOLOCALE === 'true';

const supportedLngs = ['en', 'ga', 'es', 'fr', 'de', 'ja', 'ko'];
if (isPseudolocaleEnabled) supportedLngs.push('en-XA');

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ga: { translation: ga },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      ko: { translation: ko },
      ...(isPseudolocaleEnabled && {
        'en-XA': { translation: pseudolocalizeResources(en) },
      }),
    },
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
  });

export default i18n;

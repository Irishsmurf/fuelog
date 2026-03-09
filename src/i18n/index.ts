import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ga from './locales/ga.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ga: { translation: ga },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ga'],
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

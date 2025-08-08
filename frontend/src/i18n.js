import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend) // Dynamic loading of language files
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Lazy loading configuration
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    fallbackLng: 'en',
    debug: import.meta.env.DEV, // Use Vite's environment variable
    
    // Performance optimization
    load: 'languageOnly', // Don't load regional variants (en-US -> en)
    preload: ['en'], // Preload main language
    
    // Web app language detection settings
    detection: {
      order: [
        'querystring',    // ?lng=en
        'localStorage',   // Browser storage
        'cookie',         // Persistent storage
        'htmlTag'         // HTML lang attribute
      ],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
      
      // Cache duration
      cookieMinutes: 10080, // 7 days
    },
    
    // Namespace configuration - split by page
    ns: ['common', 'dashboard', 'settings'],
    defaultNS: 'common',
    
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    
    // SEO-friendly settings
    cleanCode: true,
    
    react: {
      // Performance optimization
      useSuspense: true, // Works with React Suspense
      bindI18n: 'languageChanged',
      bindI18nStore: 'added',
      transEmptyNodeValue: '', // Empty node handling
    }
  });

export default i18n;

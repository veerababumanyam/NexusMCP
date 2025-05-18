import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// List of supported languages
export const supportedLanguages = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  sv: 'Svenska',
  no: 'Norsk',
  fi: 'Suomi',
  da: 'Dansk',
  et: 'Eesti',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  pl: 'Polski',
  cs: 'Čeština',
  sk: 'Slovenčina',
  hu: 'Magyar',
  ro: 'Română',
  bg: 'Български',
  uk: 'Українська',
  ru: 'Русский',
  el: 'Ελληνικά',
  sl: 'Slovenščina',
  hr: 'Hrvatski',
  sr: 'Српски',
  mk: 'Македонски',
  bs: 'Bosanski',
  sq: 'Shqip',
  ga: 'Gaeilge',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ar: 'العربية'
};

// Language detection options
const detectionOptions = {
  // Order of language detection
  order: ['localStorage', 'navigator'],
  
  // Keys to lookup language from
  lookupLocalStorage: 'nexusmcp-language',
  
  // Cache user language
  caches: ['localStorage'],
  
  // Only detect once (to prevent redetection on page reload)
  cookieMinutes: 10080, // 7 days
};

i18n
  // Load translations from the /locales folder
  .use(Backend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18n
  .init({
    // Fallback language in case detection fails
    fallbackLng: 'en',
    
    // Debug in development environment
    debug: process.env.NODE_ENV === 'development',
    
    // Detection options
    detection: detectionOptions,
    
    // Common namespaces used across the application
    ns: ['translation'],
    defaultNS: 'translation',
    
    // Interpolation configuration
    interpolation: {
      // React already safeguards against XSS
      escapeValue: false
    },
    
    // React configuration
    react: {
      useSuspense: true,
    },
    
    // Backend configuration
    backend: {
      // Path to load translations from
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    }
  });

// Helper function to change language and save preference
export const changeLanguage = (language: string) => {
  i18n.changeLanguage(language);
  localStorage.setItem('nexusmcp-language', language);
};

// Function to get the current language
export const getCurrentLanguage = () => {
  return i18n.language || localStorage.getItem('nexusmcp-language') || 'en';
};

export default i18n;
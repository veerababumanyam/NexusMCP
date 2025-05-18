import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage as i18nChangeLanguage, getCurrentLanguage, supportedLanguages } from './i18n';

type I18nContextType = {
  currentLanguage: string;
  changeLanguage: (lang: string) => void;
  supportedLanguages: Record<string, string>;
  isLoaded: boolean;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  const [isLoaded, setIsLoaded] = useState(i18n.isInitialized);

  // Monitor i18n initialization
  useEffect(() => {
    const handleLoaded = () => {
      setIsLoaded(true);
    };

    if (i18n.isInitialized) {
      setIsLoaded(true);
    } else {
      i18n.on('initialized', handleLoaded);
    }

    return () => {
      i18n.off('initialized', handleLoaded);
    };
  }, [i18n]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng);
      // Store in localStorage to persist the preference
      localStorage.setItem('nexusmcp-language', lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  // When component mounts, ensure i18n and state are in sync
  useEffect(() => {
    const storedLang = localStorage.getItem('nexusmcp-language');
    const currentLang = i18n.language;
    
    // If there's a stored language that differs from the current i18n language
    if (storedLang && storedLang !== currentLang) {
      i18n.changeLanguage(storedLang);
    } else if (currentLang !== currentLanguage) {
      // Otherwise ensure our state matches i18n's state
      setCurrentLanguage(currentLang);
    }
  }, [i18n, currentLanguage]);

  // Handle language change
  const changeLanguage = (lang: string) => {
    if (lang !== currentLanguage) {
      i18n.changeLanguage(lang);
      // State update will be handled by the languageChanged event listener
    }
  };

  const value = {
    currentLanguage,
    changeLanguage,
    supportedLanguages,
    isLoaded,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
// constants/localization.tsx
import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import i18n, { initializeLocalization } from './i18n';

interface LocalizationContextType {
  locale: string;
  isRTL: boolean;
  textDirection: 'ltr' | 'rtl';
  t: (key: string, params?: object) => string;
  changeLanguage: (language: string) => void;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const deviceLocales = useLocales();
  const [currentLocale, setCurrentLocale] = useState('ar');
  const [isRTL, setIsRTL] = useState(false);
  const [textDirection, setTextDirection] = useState<'ltr' | 'rtl'>('rtl');

  useEffect(() => {
    // Initialize localization on mount
    const localizationData = initializeLocalization();
    setCurrentLocale(localizationData.locale);
    setIsRTL(localizationData.isRTL);
    setTextDirection(localizationData.textDirection || (localizationData.isRTL ? 'rtl' : 'ltr'));
    
    // CRITICAL: Keep UI layout LTR while allowing text RTL
    // This is the key fix - disable RTL layout transformation
    I18nManager.allowRTL(false);  // ❌ Don't allow UI to flip to RTL
    I18nManager.swapLeftAndRightInRTL(false);  // ❌ Don't swap UI elements
    
    // Log the current state for debugging
    console.log('🔍 I18nManager Status after setup:', {
      isRTL: I18nManager.isRTL,
      allowRTL: I18nManager.allowRTL,
      currentLocale: localizationData.locale,
      textDirection: localizationData.textDirection
    });
  }, []);

  // Watch for device locale changes (mainly for Android)
  useEffect(() => {
    const primaryLocale = deviceLocales[0];
    const languageCode = primaryLocale?.languageCode || 'ar';
    const supportedLanguages = ['en', 'ar', 'fr'];
    const selectedLanguage = supportedLanguages.includes(languageCode) ? languageCode : 'ar';
    
    if (selectedLanguage !== currentLocale) {
      changeLanguage(selectedLanguage);
    }
  }, [deviceLocales]);

  const changeLanguage = (language: string) => {
    console.log('🔄 Changing language to:', language);
    
    i18n.locale = language;
    setCurrentLocale(language);
    
    const isRTLLanguage = language === 'ar';
    setIsRTL(isRTLLanguage);
    setTextDirection(isRTLLanguage ? 'rtl' : 'ltr');

    // IMPORTANT: Never change I18nManager settings during language change
    // UI layout should always stay LTR regardless of text language
    console.log('✅ Language changed successfully:', {
      language,
      isRTL: isRTLLanguage,
      textDirection: isRTLLanguage ? 'rtl' : 'ltr',
      uiStaysLTR: true
    });
  };

  const t = (key: string, params?: object) => {
    return i18n.t(key, params);
  };

  const value: LocalizationContextType = {
    locale: currentLocale,
    isRTL,
    textDirection,
    t,
    changeLanguage,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
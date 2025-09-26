// constants/i18n.ts
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { fr } from './locales/fr';



// Create i18n instance
const i18n = new I18n();

// Set translations
i18n.translations = {
  en,
  ar,
  fr,
};

// Configure fallbacks and other options
i18n.enableFallback = true;
i18n.defaultLocale = 'ar';

// Function to initialize localization
export const initializeLocalization = () => {
  // Get device locales
  const deviceLocales = getLocales();
  const primaryLocale = deviceLocales[0];
  
  // Extract language code (e.g., 'ar' from 'ar-SA')
  const languageCode = primaryLocale.languageCode || 'en';
  
  // Set locale based on supported languages
  const supportedLanguages = ['en', 'ar', 'fr'];
  const selectedLanguage = supportedLanguages.includes(languageCode) 
    ? languageCode 
    : 'ar';
  
  i18n.locale = selectedLanguage;
  
  // Get text direction from device locale
  const isRTL = primaryLocale.textDirection === 'rtl' || selectedLanguage === 'ar';
  
  return {
    locale: selectedLanguage,
    isRTL,
    textDirection: primaryLocale.textDirection,
  };
};

// Translation function
export const t = (key: string, params?: object) => {
  return i18n.t(key, params);
};

// Get current locale
export const getCurrentLocale = () => i18n.locale;

// Check if current locale is RTL
export const isRTL = () => I18nManager.isRTL;

export default i18n;
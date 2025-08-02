// Centralized language configuration
// Add new languages here and they'll be automatically available throughout the app

export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '/img/svg/united-states.svg'
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '/img/svg/germany.svg'
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '/img/svg/spain.svg'
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '/img/svg/france.svg'
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '/img/svg/netherlands.svg'
  }
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export const LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguageCode[];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';

// Helper function to get language info
export function getLanguageInfo(code: string) {
  return SUPPORTED_LANGUAGES[code as SupportedLanguageCode] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

// Helper function to get all language options for dropdowns
export function getLanguageOptions() {
  return Object.values(SUPPORTED_LANGUAGES);
}

// Helper function to validate language code
export function isValidLanguageCode(code: string): code is SupportedLanguageCode {
  return code in SUPPORTED_LANGUAGES;
} 
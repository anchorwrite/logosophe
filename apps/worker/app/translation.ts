import { createInstance, InitOptions } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import type { Locale } from '@/types/i18n';

import translationEn from "@/locales/en/translation.json";
import translationEs from "@/locales/es/translation.json";
import translationDe from "@/locales/de/translation.json";
import translationFr from "@/locales/fr/translation.json";
import translationNl from "@/locales/nl/translation.json";

const i18n = createInstance();

const config: InitOptions = {
  debug: false,
  fallbackLng: "en",
  keySeparator: ".",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translations: translationEn
    },
    es: {
      translations: translationEs
    },
    de: {
      translations: translationDe
    },
    fr: {
      translations: translationFr
    },
    nl: {
      translations: translationNl
    }
  },
  ns: ["translations"],
  defaultNS: "translations",
  returnObjects: true,
  detection: {
    order: ['path', 'localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged loaded',
    transEmptyNodeValue: '',
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init(config);

export const locales: Locale[] = ['en', 'es', 'de', 'fr', 'nl'];
export const defaultLocale: Locale = 'en';

export default i18n;
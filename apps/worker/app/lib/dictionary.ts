import 'server-only'
import type { Locale } from '@/types/i18n'

const dictionaries = {
  en: () => import('@/locales/en/translation.json').then((module) => module.default || module),
  es: () => import('@/locales/es/translation.json').then((module) => module.default || module),
  de: () => import('@/locales/de/translation.json').then((module) => module.default || module),
  fr: () => import('@/locales/fr/translation.json').then((module) => module.default || module),
  nl: () => import('@/locales/nl/translation.json').then((module) => module.default || module),
}

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]()
} 
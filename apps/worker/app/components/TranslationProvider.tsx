'use client'

import { PropsWithChildren, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/translation'

interface TranslationProviderProps extends PropsWithChildren {
  locale: string
}

export default function TranslationProvider({ children, locale }: TranslationProviderProps) {
  const { i18n: i18nInstance } = useTranslation()

  // Set language synchronously to avoid hydration mismatch
  if (locale && i18nInstance.language !== locale) {
    i18nInstance.changeLanguage(locale)
  }

  useEffect(() => {
    if (locale && i18nInstance.language !== locale) {
      i18nInstance.changeLanguage(locale)
    }
  }, [locale, i18nInstance])

  return <>{children}</>
} 
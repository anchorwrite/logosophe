'use client'

import { I18nextProvider } from 'react-i18next'
import i18n from '@/translation'
import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/lib/theme-context'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

interface ProvidersProps {
  children: React.ReactNode;
  lang?: string;
}

function Providers({ children, lang }: ProvidersProps) {
  const pathname = usePathname()
  
  // Use provided lang prop or extract from pathname as fallback
  const detectedLang = lang || (() => {
    const pathSegments = pathname.split('/')
    return pathSegments.length > 1 && ['en', 'es', 'de', 'fr', 'nl'].includes(pathSegments[1]) 
      ? pathSegments[1] 
      : 'en'
  })()

  // Only change language in useEffect to avoid setState during render
  useEffect(() => {
    if (detectedLang && i18n.language !== detectedLang) {
      i18n.changeLanguage(detectedLang)
    }
  }, [detectedLang])

  return (
    <SessionProvider>
      <I18nextProvider i18n={i18n} defaultNS="translations">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </I18nextProvider>
    </SessionProvider>
  )
}

export default Providers;
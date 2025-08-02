'use client'

import { I18nextProvider } from 'react-i18next'
import i18n from '@/translation'
import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/lib/theme-context'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const lang = pathname.split('/')[1] || 'en'

  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [lang])

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
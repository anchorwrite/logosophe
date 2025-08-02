'use client'

import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/lib/theme-context'
import { ThemeWrapper } from '@/components/ThemeWrapper'
import '@radix-ui/themes/styles.css'

function ProvidersNoI18n({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ThemeWrapper>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeWrapper>
      </ThemeProvider>
    </SessionProvider>
  )
}

export default ProvidersNoI18n; 
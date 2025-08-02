import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import { ThemeWrapper } from '@/components/ThemeWrapper'
import '@radix-ui/themes/styles.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Logosophe',
  description: 'Logosophe - Your Writing Companion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body className={inter.className}>
        <Providers>
          <ThemeWrapper>
            {children}
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  )
} 
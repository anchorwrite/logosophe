import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/globals.css'
import Providers from '@/providers'
import { ThemeWrapper } from '@/components/ThemeWrapper'
import '@radix-ui/themes/styles.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Logosophe',
  description: 'Logosophe - Your Writing Companion',
}

export default async function InternationalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params;
  return (
    <Providers>
      <ThemeWrapper>
        {children}
      </ThemeWrapper>
    </Providers>
  )
} 
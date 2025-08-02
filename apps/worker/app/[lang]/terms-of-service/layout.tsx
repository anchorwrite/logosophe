import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Logosophe',
  description: 'Read our Terms of Service to understand the rules, guidelines, and legal agreements that govern your use of Logosophe.',
  openGraph: {
    title: 'Terms of Service | Logosophe',
    description: 'Read our Terms of Service to understand the rules, guidelines, and legal agreements that govern your use of Logosophe.',
    type: 'website',
    url: 'https:/www.logosophe.com/terms-of-service',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | Logosophe',
    description: 'Read our Terms of Service to understand the rules, guidelines, and legal agreements that govern your use of Logosophe.',
  },
  alternates: {
    canonical: 'https:/www.logosophe.com/terms-of-service',
  },
}

export default function TermsOfServiceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
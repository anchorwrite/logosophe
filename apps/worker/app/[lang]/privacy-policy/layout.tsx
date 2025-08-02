import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Logosophe',
  description: 'Learn about how Logosophe collects, uses, and protects your personal information. Read our comprehensive privacy policy to understand your rights and our data practices.',
  openGraph: {
    title: 'Privacy Policy | Logosophe',
    description: 'Learn about how Logosophe collects, uses, and protects your personal information.',
    type: 'website',
    url: 'https:/www.logosophe.com/privacy-policy',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Logosophe',
    description: 'Learn about how Logosophe collects, uses, and protects your personal information.',
  },
  alternates: {
    canonical: 'https:/www.logosophe.com/privacy-policy',
  },
}

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
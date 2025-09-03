import { NextResponse, type NextRequest } from 'next/server'
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

// List of all supported locales
const locales = ['en', 'fr', 'nl', 'es', 'de']
const defaultLocale = 'en'

// Get the preferred locale from the request headers
function getLocale(request: NextRequest) {
  const negotiatorHeaders: Record<string, string> = {}
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value))

  // @ts-ignore locales are readonly
  const languages = new Negotiator({ headers: negotiatorHeaders }).languages()
  
  try {
    return match(languages, locales, defaultLocale)
  } catch (error) {
    return defaultLocale
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip locale redirection for non-translated routes
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/test-signin') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/share/') ||
      pathname.startsWith('/error')) return

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return

  // Redirect if there is no locale
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, and static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|img/|images/|assets/).*)']
} 
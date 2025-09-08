# Internationalization (i18n) Guide

This document provides a comprehensive guide to how internationalization is implemented in the Logosophe project.

## Overview

The project supports 5 languages:
- **English (en)** - Default language
- **Spanish (es)**
- **French (fr)**
- **German (de)**
- **Dutch (nl)**

## Architecture

### Dual Translation System

The project uses a **dual translation system** to handle both server-side and client-side rendering:

1. **Server-side**: Uses `getDictionary()` for server components
2. **Client-side**: Uses `react-i18next` for client components

### File Structure

```
apps/worker/app/
├── locales/                    # Translation files
│   ├── en/translation.json     # English translations
│   ├── es/translation.json     # Spanish translations
│   ├── fr/translation.json     # French translations
│   ├── de/translation.json     # German translations
│   └── nl/translation.json     # Dutch translations
├── [lang]/                     # Internationalized routes
│   ├── layout.tsx              # Layout with language parameter
│   ├── page.tsx                # Home page
│   ├── signin/page.tsx         # Sign-in page
│   ├── signout/page.tsx        # Sign-out page
│   └── harbor/                 # Harbor module pages
├── lib/
│   └── dictionary.ts           # Server-side dictionary loader
├── translation.ts              # Client-side i18n configuration
├── providers.tsx               # i18n provider setup
└── types/
    └── i18n.ts                 # TypeScript types for locales
```

## Core Components

### 1. Type Definitions (`types/i18n.ts`)

```typescript
export type Locale = 'en' | 'es' | 'de' | 'fr' | 'nl'

export interface Dictionary {
  [key: string]: string | Dictionary
}
```

### 2. Server-side Dictionary (`lib/dictionary.ts`)

```typescript
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
```

### 3. Client-side Configuration (`translation.ts`)

```typescript
import { createInstance, InitOptions } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const i18n = createInstance();

const config: InitOptions = {
  debug: false,
  fallbackLng: "en",
  keySeparator: ".",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: { translations: translationEn },
    es: { translations: translationEs },
    de: { translations: translationDe },
    fr: { translations: translationFr },
    nl: { translations: translationNl }
  },
  ns: ["translations"],
  defaultNS: "translations",
  returnObjects: true,
  detection: {
    order: ['path', 'localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged loaded',
    transEmptyNodeValue: '',
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
  }
};

export const locales: Locale[] = ['en', 'es', 'de', 'fr', 'nl'];
export const defaultLocale: Locale = 'en';
```

### 4. Provider Setup (`providers.tsx`)

```typescript
'use client'

import { I18nextProvider } from 'react-i18next'
import i18n from '@/translation'

function Providers({ children, lang }: { children: React.ReactNode; lang?: string }) {
  const pathname = usePathname()
  
  // Use provided lang prop or extract from pathname as fallback
  const detectedLang = lang || (() => {
    const pathSegments = pathname.split('/')
    return pathSegments.length > 1 && ['en', 'es', 'de', 'fr', 'nl'].includes(pathSegments[1]) 
      ? pathSegments[1] 
      : 'en'
  })()

  // Use useEffect to change language after component mounts
  useEffect(() => {
    if (detectedLang && i18n.language !== detectedLang) {
      i18n.changeLanguage(detectedLang)
    }
  }, [detectedLang])

  return (
    <I18nextProvider i18n={i18n} defaultNS="translations">
      {children}
    </I18nextProvider>
  )
}
```

## URL Structure

### Internationalized Routes

All user-facing pages use the `/[lang]/` URL structure:

- `/en/` - English (default)
- `/es/` - Spanish
- `/fr/` - French
- `/de/` - German
- `/nl/` - Dutch

### Non-Internationalized Routes

The following routes are **NOT** internationalized and remain in English:

- `/dashboard/*` - Administrative dashboard
- `/api/*` - API endpoints
- `/test-signin` - Test pages
- `/.well-known/*` - Domain verification files
- `/error` - Error pages

### Middleware Configuration

The middleware (`middleware.ts`) handles automatic locale detection and redirection:

```typescript
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip locale redirection for non-translated routes
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/test-signin') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/share/') ||
      pathname.startsWith('/.well-known/') ||
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
```

## Usage Patterns

### Server Components

For server components, use `getDictionary()`:

```typescript
import { getDictionary } from '@/lib/dictionary'
import type { Locale } from '@/types/i18n'

export default async function MyPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  
  return (
    <div>
      <h1>{dict.page.title}</h1>
      <p>{dict.page.description}</p>
    </div>
  )
}
```

### Client Components

For client components, use `useTranslation()`:

```typescript
'use client'

import { useTranslation } from 'react-i18next'

export default function MyComponent() {
  const { t } = useTranslation('translations')
  
  return (
    <div>
      <h1>{t('page.title')}</h1>
      <p>{t('page.description')}</p>
    </div>
  )
}
```

### Hybrid Components (Server + Client)

When you need both server and client translations in the same component:

```typescript
import { getDictionary } from '@/lib/dictionary'
import { MyClientComponent } from './MyClientComponent'

export default async function MyPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  
  return (
    <div>
      {/* Server-side translation */}
      <h1>{dict.page.title}</h1>
      
      {/* Pass translations to client component */}
      <MyClientComponent translations={dict.clientSection} />
    </div>
  )
}
```

### Client Component with Props

```typescript
'use client'

interface MyClientComponentProps {
  translations: {
    title: string;
    description: string;
  };
}

export function MyClientComponent({ translations }: MyClientComponentProps) {
  return (
    <div>
      <h2>{translations.title}</h2>
      <p>{translations.description}</p>
    </div>
  )
}
```

## Translation File Structure

Translation files use a nested JSON structure with dot notation for keys:

```json
{
  "common": {
    "actions": {
      "submit": "Submit",
      "cancel": "Cancel",
      "save": "Save"
    },
    "status": {
      "loading": "Loading...",
      "error": "Error",
      "success": "Success"
    }
  },
  "auth": {
    "signIn": "Sign In",
    "signOut": "Sign Out",
    "signUp": "Sign Up"
  },
  "harbor": {
    "nav": {
      "harbor": "Harbor",
      "profile": "Profile"
    }
  },
  "signin": {
    "title": "Sign In",
    "errors": {
      "genericError": "An error occurred",
      "accountNotLinked": "Account Not Linked",
      "accountNotLinkedDescription": "This account is already linked to a different sign-in method."
    }
  }
}
```

### Accessing Nested Keys

- **Server-side**: `dict.auth.signIn`
- **Client-side**: `t('auth.signIn')`

## Navigation and Links

### Internal Links

Always use the language parameter in internal links:

```typescript
// ✅ Correct
<Link href={`/${lang}/harbor`}>Harbor</Link>
<Link href={`/${lang}/signout`}>Sign Out</Link>

// ❌ Incorrect (hardcoded)
<Link href="/harbor">Harbor</Link>
<Link href="/signout">Sign Out</Link>
```

### Programmatic Navigation

```typescript
import { useRouter } from 'next/navigation'

function MyComponent() {
  const router = useRouter()
  
  const handleNavigation = () => {
    const currentLang = window.location.pathname.split('/')[1] || 'en'
    router.push(`/${currentLang}/harbor`)
  }
}
```

## Language Detection

The system detects language in this order:

1. **URL path** (`/es/page` → Spanish)
2. **localStorage** (`i18nextLng` key)
3. **Browser navigator** (Accept-Language header)

## Best Practices

### 1. Translation Key Naming

Use descriptive, hierarchical keys:

```json
{
  "signin": {
    "errors": {
      "accountNotLinked": "Account Not Linked",
      "accountNotLinkedDescription": "This account is already linked to a different sign-in method."
    }
  }
}
```

### 2. Consistent Translation Style

- Use **informal second person** form ("you" instead of "one")
- Maintain consistent tone across all languages
- Keep technical terms in English when appropriate

### 3. Fallback Handling

Always provide fallbacks for missing translations:

```typescript
// Server-side
const title = dict.page?.title || 'Default Title'

// Client-side
const title = t('page.title', 'Default Title')
```

### 4. Type Safety

Use TypeScript interfaces for translation props:

```typescript
interface SignOutButtonsProps {
  lang: string;
  translations: {
    staySignedIn: string;
    yesSignOut: string;
  };
}
```

### 5. Testing Translations

Test all languages during development:

- `/en/signout` - English
- `/es/signout` - Spanish  
- `/fr/signout` - French
- `/de/signout` - German
- `/nl/signout` - Dutch

## Common Issues and Solutions

### Issue: Client Component Shows English

**Problem**: Client component always shows English despite correct URL.

**Solution**: Ensure the component is wrapped in the `I18nextProvider` and uses `useTranslation('translations')`.

### Issue: Server Component Translation Not Working

**Problem**: Server component shows undefined or English.

**Solution**: Verify the translation key exists in all language files and use the correct dot notation.

### Issue: Hardcoded Links

**Problem**: Links go to `/page` instead of `/${lang}/page`.

**Solution**: Always use template literals with the `lang` parameter: `href={`/${lang}/page`}`

### Issue: Mixed Server/Client Translation

**Problem**: Need both server and client translations in one component.

**Solution**: Pass server translations as props to client components instead of using both systems in the same component.

## Adding New Languages

To add a new language (e.g., Italian):

1. **Add to types** (`types/i18n.ts`):
   ```typescript
   export type Locale = 'en' | 'es' | 'de' | 'fr' | 'nl' | 'it'
   ```

2. **Create translation file** (`locales/it/translation.json`):
   ```json
   {
     "common": {
       "actions": {
         "submit": "Invia",
         "cancel": "Annulla"
       }
     }
   }
   ```

3. **Update dictionary** (`lib/dictionary.ts`):
   ```typescript
   const dictionaries = {
     // ... existing languages
     it: () => import('@/locales/it/translation.json').then((module) => module.default || module),
   }
   ```

4. **Update client config** (`translation.ts`):
   ```typescript
   import translationIt from "@/locales/it/translation.json";
   
   const config: InitOptions = {
     resources: {
       // ... existing languages
       it: { translations: translationIt }
     }
   };
   
   export const locales: Locale[] = ['en', 'es', 'de', 'fr', 'nl', 'it'];
   ```

5. **Update middleware** (`middleware.ts`):
   ```typescript
   const locales = ['en', 'fr', 'nl', 'es', 'de', 'it']
   ```

6. **Update providers** (`providers.tsx`):
   ```typescript
   return pathSegments.length > 1 && ['en', 'es', 'de', 'fr', 'nl', 'it'].includes(pathSegments[1])
   ```

## Dependencies

The internationalization system uses these key dependencies:

- `react-i18next` - React integration for i18next
- `i18next` - Core internationalization framework
- `i18next-browser-languagedetector` - Language detection
- `@formatjs/intl-localematcher` - Locale matching
- `negotiator` - HTTP content negotiation

## Maintenance

### Regular Tasks

1. **Sync translation files** - Ensure all language files have the same keys
2. **Test all languages** - Verify functionality across all supported languages
3. **Update documentation** - Keep this guide current with any changes
4. **Review new features** - Ensure new features are properly internationalized

### Translation Management

Consider using a translation management service for larger projects:
- Crowdin
- Lokalise
- Transifex
- Weblate

## Conclusion

This internationalization system provides a robust, scalable solution for multi-language support. The dual translation system ensures optimal performance for both server and client rendering, while the middleware handles automatic language detection and routing.

For questions or issues, refer to the [react-i18next documentation](https://react.i18next.com/) or the project's existing internationalized components for examples.

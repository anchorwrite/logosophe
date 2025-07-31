export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português'
}

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en' 
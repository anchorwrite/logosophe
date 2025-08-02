export type Locale = 'en' | 'es' | 'de' | 'fr' | 'nl'

export interface Dictionary {
  [key: string]: string | Dictionary
} 
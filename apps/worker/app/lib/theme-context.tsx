'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { D1Database } from '@cloudflare/workers-types';
import { SupportedLanguageCode, isValidLanguageCode, DEFAULT_LANGUAGE } from './languages';

type Theme = 'light' | 'dark';

interface PreferencesResponse {
  theme: Theme;
  language: SupportedLanguageCode;
  isPersistent: boolean;
  email: string;
  provider: string | null;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: SupportedLanguageCode;
  setLanguage: (language: SupportedLanguageCode) => void;
  isAuthenticated: boolean;
  isPersistent: boolean;
  isLoading: boolean;
  userEmail: string | null;
  userProvider: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'logosophe-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [theme, setThemeState] = useState<Theme>('light');
  const [language, setLanguageState] = useState<SupportedLanguageCode>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [isPersistent, setIsPersistentState] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProvider, setUserProvider] = useState<string | null>(null);

  const isAuthenticated = !!session?.user?.email;

  // Load theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        if (isAuthenticated) {
          // Try to load from database first
          const response = await fetch('/api/user/preferences');
          if (response.ok) {
            const data = await response.json() as PreferencesResponse;
            setThemeState(data.theme);
            setLanguageState(data.language);
            setIsPersistentState(data.isPersistent);
            setUserEmail(data.email);
            setUserProvider(data.provider);
          } else {
            // Fallback to localStorage
            const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
            const storedLanguage = localStorage.getItem('logosophe-language');
            if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
              setThemeState(storedTheme);
            }
            if (storedLanguage && isValidLanguageCode(storedLanguage)) {
              setLanguageState(storedLanguage as SupportedLanguageCode);
            }
            setIsPersistentState(false);
          }
        } else {
          // Anonymous user - load from localStorage
          const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
          const storedLanguage = localStorage.getItem('logosophe-language');
          if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
            setThemeState(storedTheme);
          }
          if (storedLanguage && isValidLanguageCode(storedLanguage)) {
            setLanguageState(storedLanguage as SupportedLanguageCode);
          }
          setIsPersistentState(false);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to localStorage for any error
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
        if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
          setThemeState(storedTheme);
        }
        setIsPersistentState(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== 'loading') {
      loadTheme();
    }
  }, [isAuthenticated, status]);

  // Update theme function
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    
    // Store in localStorage for all users
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    
    // Update database for authenticated users only if session is loaded and user is authenticated
    if (status === 'authenticated' && isAuthenticated) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ theme: newTheme, language }),
        });
        if (!response.ok) {
          console.error('Failed to update theme in database:', response.status);
        }
      } catch (error) {
        console.error('Error updating theme in database:', error);
      }
    }
  };

  // Update language function
  const setLanguage = async (newLanguage: SupportedLanguageCode) => {
    setLanguageState(newLanguage);
    
    // Store in localStorage for all users
    localStorage.setItem('logosophe-language', newLanguage);
    
    // Update database for authenticated users only if session is loaded and user is authenticated
    if (status === 'authenticated' && isAuthenticated) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ theme, language: newLanguage }),
        });
        if (!response.ok) {
          console.error('Failed to update language in database:', response.status);
        }
      } catch (error) {
        console.error('Error updating language in database:', error);
      }
    }
  };

  // Migrate localStorage to database when user authenticates
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      const storedLanguage = localStorage.getItem('logosophe-language');
      
      if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
        // Migrate theme to database
        fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            theme: storedTheme, 
            language: (storedLanguage && isValidLanguageCode(storedLanguage)) ? storedLanguage : DEFAULT_LANGUAGE 
          }),
        }).then(() => {
          // Clear localStorage after successful migration
          localStorage.removeItem(THEME_STORAGE_KEY);
          localStorage.removeItem('logosophe-language');
        }).catch((error) => {
          console.error('Error migrating preferences to database:', error);
        });
      }
    }
  }, [isAuthenticated, isLoading]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    language,
    setLanguage,
    isAuthenticated,
    isPersistent,
    isLoading,
    userEmail,
    userProvider,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 
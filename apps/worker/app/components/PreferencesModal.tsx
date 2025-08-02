'use client';

import React, { useState } from 'react';
import { Button, Dialog, Flex, Text, Switch, Box, Select, AlertDialog } from '@radix-ui/themes';
import { useTheme } from '@/lib/theme-context';
import { Moon, Sun, Info, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/lib/languages';
import { shouldInternationalizePath } from '@/lib/route-utils';

interface PreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreferencesModal({ open, onOpenChange }: PreferencesModalProps) {
  const { theme, setTheme, language, setLanguage, isAuthenticated, isPersistent, isLoading } = useTheme();
  const { t, i18n } = useTranslation('translations');
  const router = useRouter();
  const pathname = usePathname();

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const handleLanguageChange = (newLanguage: string) => {
    const languageCode = newLanguage as SupportedLanguageCode;
    
    // For all users, change language immediately
    // Update the persisted language preference
    setLanguage(languageCode);
    
    // Change the language in i18n
    i18n.changeLanguage(languageCode);
    
    // For anonymous users, also navigate if on internationalized route
    if (!isAuthenticated) {
      // Check if we're on an internationalized route (has language prefix)
      const pathSegments = pathname.split('/');
      const hasLanguagePrefix = pathSegments.length > 1 && 
        Object.keys(SUPPORTED_LANGUAGES).includes(pathSegments[1]);
      
      // Use the same logic as middleware to determine if path should be internationalized
      if (hasLanguagePrefix && shouldInternationalizePath(pathname)) {
        // For internationalized routes, navigate to the new language path
        const pathWithoutLang = pathSegments.slice(2).join('/');
        const newPath = `/${languageCode}/${pathWithoutLang}`;
        router.push(newPath);
      }
    }
    // For authenticated users, just change language without navigation
    // The page will re-render with the new language
  };



  if (isLoading) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ 
        maxWidth: '90vw',
        width: '400px',
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, 0)',
        maxHeight: '70vh',
        overflow: 'auto',
        zIndex: 100000,
        backgroundColor: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)'
      }}>
        <Dialog.Title>{t('preferences.title')}</Dialog.Title>
        <Dialog.Description>
          {t('preferences.description')}
        </Dialog.Description>
        
        <Box style={{ marginTop: '1rem' }}>
          <Flex direction="column" gap="4">
            {/* Theme Toggle */}
            <Box>
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  {theme === 'light' ? (
                    <Sun size={16} />
                  ) : (
                    <Moon size={16} />
                  )}
                  <Text size="3" weight="medium">
                    {theme === 'light' ? t('preferences.theme.light') : t('preferences.theme.dark')}
                  </Text>
                </Flex>
                <Switch 
                  checked={theme === 'dark'}
                  onCheckedChange={handleThemeToggle}
                />
              </Flex>
              
              {/* Persistence Indicator */}
              {!isPersistent && (
                <Flex align="center" gap="1" style={{ marginTop: '0.5rem' }}>
                  <Info size={12} color="var(--gray-9)" />
                  <Text size="1" color="gray">
                    {t('preferences.persistence.notPersistent')}
                  </Text>
                </Flex>
              )}
            </Box>

            {/* Language Selection */}
            <Box>
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <Globe size={16} />
                  <Text size="3" weight="medium">
                    {t('Language')}
                  </Text>
                </Flex>
                <Select.Root value={language} onValueChange={handleLanguageChange}>
                  <Select.Trigger />
                  <Select.Content>
                    {Object.values(SUPPORTED_LANGUAGES).map(lang => (
                      <Select.Item key={lang.code} value={lang.code}>
                        {lang.nativeName}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Box>

            {/* Authentication Status */}
            <Box style={{ 
              padding: '0.75rem', 
              backgroundColor: 'var(--gray-2)', 
              borderRadius: 'var(--radius-2)' 
            }}>
              <Flex align="center" gap="2">
                <Info size={14} />
                <Text size="2" color="gray">
                  {isAuthenticated 
                    ? t('preferences.persistence.authenticated')
                    : t('preferences.persistence.anonymous')
                  }
                </Text>
              </Flex>
            </Box>
          </Flex>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t('preferences.close')}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
} 
'use client';

import { Theme } from '@radix-ui/themes';
import { useTheme } from '@/lib/theme-context';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export function ThemeWrapper({ children }: ThemeWrapperProps) {
  const { theme, isLoading } = useTheme();

  // Show loading state or default theme while loading
  const currentTheme = isLoading ? 'light' : theme;

  return (
    <Theme 
      appearance={currentTheme} 
      accentColor="blue" 
      grayColor="slate" 
      scaling="100%"
    >
      {children}
    </Theme>
  );
} 
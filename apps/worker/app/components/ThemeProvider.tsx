'use client';

import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { useEffect, useState } from 'react';

type Scaling = '90%' | '95%' | '100%' | '105%' | '110%';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scaling, setScaling] = useState<Scaling>('100%');

  useEffect(() => {
    const updateScaling = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const minDimension = Math.min(vw, vh);
      
      // Calculate scaling based on viewport dimensions
      // This will scale between 90% and 110% based on viewport size
      const calculatedScaling = Math.min(
        110,
        Math.max(
          90,
          (minDimension / 1000) * 100
        )
      );
      
      // Convert to the nearest valid scaling value
      const validScaling = Math.round(calculatedScaling / 5) * 5;
      setScaling(`${validScaling}%` as Scaling);
    };

    // Initial calculation
    updateScaling();

    // Update on resize
    window.addEventListener('resize', updateScaling);
    return () => window.removeEventListener('resize', updateScaling);
  }, []);

  return (
    <Theme appearance="light" accentColor="blue" grayColor="slate" scaling={scaling}>
      {children}
    </Theme>
  );
} 
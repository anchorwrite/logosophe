'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    // Reset scroll position when navigating to a new page
    // This helps with the sticky header auto-scroll warning
    if (typeof window !== 'undefined') {
      // Small delay to ensure the page has rendered
      const timer = setTimeout(() => {
        // Only reset scroll if we're not at the top
        if (window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
} 
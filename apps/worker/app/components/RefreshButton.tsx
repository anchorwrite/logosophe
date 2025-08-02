'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@radix-ui/themes';

// Declare the type for the window object
declare global {
  interface Window {
    refreshAudioFiles?: () => void;
    refreshVideoFiles?: () => void;
    refreshMediaCatalog?: () => void;
  }
}

export default function RefreshButton() {
  const pathname = usePathname();
  const isVideoPage = pathname.includes('/video');
  const isMediaPage = pathname.includes('/media');

  const handleRefresh = () => {
    if (isVideoPage) {
      // For video pages, we'll trigger a page reload since we're using context
      window.location.reload();
    } else if (isMediaPage) {
      // For media catalog pages, use the media catalog refresh function
      if (typeof window.refreshMediaCatalog === 'function') {
        window.refreshMediaCatalog();
      }
    } else {
      // For audio pages, use the existing refresh function
      if (typeof window.refreshAudioFiles === 'function') {
        window.refreshAudioFiles();
      }
    }
  };

  return (
    <Button variant="soft" onClick={handleRefresh}>
      Refresh File Listing
    </Button>
  );
} 
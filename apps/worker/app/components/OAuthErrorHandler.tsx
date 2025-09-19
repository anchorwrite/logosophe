'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface OAuthErrorHandlerProps {
  providerInfo?: { provider: string | null; email: string } | null;
}

export default function OAuthErrorHandler({ providerInfo }: OAuthErrorHandlerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const error = searchParams.get('error');
    
    if (error === 'OAuthAccountNotLinked') {
      // Don't show toast for OAuthAccountNotLinked - let the lookup component handle it
      // Don't clean up URL - let the lookup component handle it
    } else if (error === 'Configuration') {
      showToast({
        type: 'error',
        title: t('signin.errors.configurationError'),
        content: t('signin.errors.configurationErrorDescription'),
        duration: 6000
      });
      // Clean up URL after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname + url.search);
    } else if (error === 'AccessDenied') {
      showToast({
        type: 'error',
        title: t('signin.errors.accessDenied'),
        content: t('signin.errors.accessDeniedDescription'),
        duration: 6000
      });
      // Clean up URL after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname + url.search);
    } else if (error === 'Verification') {
      showToast({
        type: 'error',
        title: t('signin.errors.verificationError'),
        content: t('signin.errors.verificationErrorDescription'),
        duration: 6000
      });
      // Clean up URL after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, showToast, t, router]);

  return null; // This component doesn't render anything
}

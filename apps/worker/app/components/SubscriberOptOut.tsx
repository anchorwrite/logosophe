"use client";

import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface SubscriberOptOutProps {
  email: string;
}

export default function SubscriberOptOut({ email }: SubscriberOptOutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation('translations');

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'delete',
          Id: email
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || t('harbor.unsubscribeError', { defaultValue: t('unsubscribeError') }));
      }

      showToast({
        title: t('common.success'),
        content: t('harbor.unsubscribeSuccess', { defaultValue: t('unsubscribeSuccess') }),
        type: 'success'
      });
      window.location.reload();
    } catch (error) {
      console.error('Unsubscription error:', error);
      showToast({
        title: t('common.error'),
        content: error instanceof Error ? error.message : t('harbor.unsubscribeError', { defaultValue: t('unsubscribeError') }),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleUnsubscribe}
      disabled={isLoading}
      variant="ghost"
      size="2"
    >
      {isLoading 
        ? t('harbor.unsubscribing', { defaultValue: 'Unsubscribing...' })
        : t('harbor.unsubscribe', { defaultValue: 'Unsubscribe' })}
    </Button>
  );
} 
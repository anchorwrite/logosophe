"use client";

import { useState, useEffect } from 'react';
import { Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface AuthenticationMessageProps {
  email: string;
}

interface ProviderResponse {
  provider: string;
}

export default function AuthenticationMessage({ email }: AuthenticationMessageProps) {
  const { t } = useTranslation('translations');
  const [provider, setProvider] = useState<string>('');

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const response = await fetch('/api/user/provider');
        if (!response.ok) {
          throw new Error('Failed to fetch provider');
        }
        const data = await response.json() as ProviderResponse;
        setProvider(data.provider);
      } catch (error) {
        console.error('Error fetching provider:', error);
      }
    };

    fetchProvider();
  }, []);

  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();

  return (
    <Text size="5" weight="medium" align="center">
      {t('harbor.signedInAsWithProvider').replace('{email}', email).replace('{provider}', capitalizedProvider)}
    </Text>
  );
} 
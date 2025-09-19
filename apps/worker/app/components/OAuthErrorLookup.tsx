'use client';

import { useState } from 'react';
import { Button, Card, Text, Flex, Box, Heading, TextField, Callout } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

export default function OAuthErrorLookup() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ email: string; provider: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const handleLookup = async () => {
    if (!email.trim()) {
      setError(t('signin.errors.pleaseEnterEmail'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setLookupResult(null);
    
    try {
      const response = await fetch(`/api/user/provider-by-email?email=${encodeURIComponent(email.trim())}`);
      const data = await response.json() as { success: boolean; email: string; provider: string; error?: string };
      
      console.log('API Response:', data);
      
      if (data.success && data.provider) {
        setLookupResult({ email: data.email, provider: data.provider });
        
        // Clean up URL after successful lookup (increased to 15 seconds)
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('error');
          router.replace(url.pathname + url.search);
        }, 15000); // Wait 15 seconds before cleaning up
      } else {
        setError(t('signin.errors.noAccountFound'));
      }
    } catch (error) {
      console.error('Error during provider lookup:', error);
      setError(t('signin.errors.tryAgainLater'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card style={{ width: '320px', marginBottom: '1.5rem' }}>
      <Box style={{ padding: '1rem' }}>
        <Flex direction="column" gap="3">
          <Box style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Heading size="4" color="red">
              {t('signin.errors.accountNotLinked')}
            </Heading>
          </Box>
          <Box style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Text color="gray" size="2" style={{ textAlign: 'center' }}>
              {t('signin.errors.enterEmailToLookup')}
            </Text>
          </Box>
          <Flex direction="column" gap="2">
            <TextField.Root>
              <TextField.Input
                type="email"
                placeholder={t('signin.enterEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLookup();
                  }
                }}
                disabled={isLoading}
              />
            </TextField.Root>
            <Button 
              onClick={handleLookup} 
              disabled={isLoading || !email.trim()}
              style={{ width: '100%' }}
            >
              {isLoading ? t('signin.errors.lookingUp') : t('signin.errors.lookupProvider')}
            </Button>
          </Flex>
        </Flex>
      </Box>
      
      {/* Show lookup result or error */}
      {lookupResult && (
        <Box style={{ padding: '0 1rem 1rem 1rem' }}>
          <Callout.Root color="green">
            <Callout.Text>
              <Flex justify="between" align="start" gap="2">
                <Box style={{ flex: 1 }}>
                  <Text weight="bold">{t('signin.errors.providerFound')}</Text>
                  <br />
                  {t('signin.errors.accountNotLinkedWithProvider')
                    .replace('{email}', lookupResult.email)
                    .replace('{provider}', lookupResult.provider)}
                </Box>
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => {
                    setLookupResult(null);
                    // Clean up URL immediately when dismissed
                    const url = new URL(window.location.href);
                    url.searchParams.delete('error');
                    router.replace(url.pathname + url.search);
                  }}
                  style={{ flexShrink: 0 }}
                >
                  ✕
                </Button>
              </Flex>
            </Callout.Text>
          </Callout.Root>
        </Box>
      )}
      
      {error && (
        <Box style={{ padding: '0 1rem 1rem 1rem' }}>
          <Callout.Root color="red">
            <Callout.Text>
              <Flex justify="between" align="start" gap="2">
                <Box style={{ flex: 1 }}>
                  {error}
                </Box>
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => setError(null)}
                  style={{ flexShrink: 0 }}
                >
                  ✕
                </Button>
              </Flex>
            </Callout.Text>
          </Callout.Root>
        </Box>
      )}
    </Card>
  );
}
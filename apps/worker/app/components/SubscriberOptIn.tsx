"use client";

import { useState, useEffect } from 'react';
import { Button, Container, Flex, Text } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface SubscriberOptInProps {
  email: string;
}

interface ProviderResponse {
  provider: string;
}

export default function SubscriberOptIn({ email }: SubscriberOptInProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const { showToast } = useToast();
  const { t } = useTranslation('translations');

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
        showToast({
          title: 'Error',
          content: 'Failed to fetch provider information',
          type: 'error'
        });
      }
    };

    fetchProvider();
  }, [showToast]);

  const handleSubscribe = async () => {
    if (!provider) {
      showToast({
        title: 'Error',
        content: 'Unable to determine your authentication provider',
        type: 'error'
      });
      return;
    }

    // Map provider to API's expected format
    const providerMap: Record<string, 'Resend' | 'Google' | 'Apple' | 'Test'> = {
      'credentials': 'Resend',
      'google': 'Google',
      'apple': 'Apple',
      'test-credentials': 'Test'
    };

    const validProvider = providerMap[provider.toLowerCase()];
    if (!validProvider) {
      showToast({
        title: 'Error',
        content: 'Invalid authentication provider',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      // First, create the subscriber record
      const subscriberResponse = await fetch('/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'insert',
          Id: email,
          provider: validProvider
        }),
      });

      if (!subscriberResponse.ok) {
        const message = await subscriberResponse.text();
        throw new Error(message || 'Failed to subscribe');
      }

      // Now send verification email
      const verificationResponse = await fetch('/api/verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name: email.split('@')[0] // Use email prefix as name
        }),
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json() as { error?: string };
        const errorMessage = errorData.error || 'Failed to send verification email';
        throw new Error(errorMessage);
      }

      showToast({
        title: 'Verification Email Sent',
        content: 'Please check your email and click the verification link to complete your subscription.',
        type: 'success'
      });
      
      // Don't reload, show verification message instead
      setVerificationSent(true);
    } catch (error) {
      console.error('Subscription error:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to subscribe. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();

  if (verificationSent) {
    return (
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Flex direction="column" gap="4" align="center">
          <Flex direction="column" gap="2" align="center">
            <Text size="5" weight="medium" align="center" color="green">
              Verification Email Sent! 📧
            </Text>
            <Text size="4" align="center" color="gray" mb="4">
              Please check your email and click the verification link to complete your subscription.
            </Text>
            <Text size="3" align="center" color="gray">
              If you don't see the email, check your spam folder.
            </Text>
          </Flex>
          <Flex justify="center" style={{ width: '100%' }}>
            <Button 
              onClick={() => setVerificationSent(false)}
              variant="outline"
              style={{ width: '100%' }}
            >
              Send Another Verification Email
            </Button>
          </Flex>
        </Flex>
      </Container>
    );
  }

  return (
    <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Flex direction="column" gap="4" align="center">
        <Flex direction="column" gap="2" align="center">
          <Text size="5" weight="medium" align="center">
            {t('harbor.signedInAsWithProvider').replace('{email}', email).replace('{provider}', capitalizedProvider)}
          </Text>
          <Text size="5" align="center" color="gray" mb="4">
            {t('harbor.becomeSubscriber')}
          </Text>
        </Flex>
        <Flex justify="center" style={{ width: '100%' }}>
          <Button 
            onClick={handleSubscribe}
            disabled={isLoading || !provider}
            style={{ width: '100%' }}
          >
            {isLoading ? t('harbor.subscribing') : t('harbor.subscribeNow')}
          </Button>
        </Flex>
      </Flex>
    </Container>
  );
} 
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Heading, Text, Card, Button, Container } from '@radix-ui/themes';
import { CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import Link from 'next/link';

interface VerificationResult {
  success: boolean;
  message: string;
  email?: string;
  verifiedAt?: string;
  error?: string;
}

export default function VerifyEmailPage() {
  const { t } = useTranslation('translations');
  const params = useParams();
  const token = params.token as string;
  
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (emailToken: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/verify-email/${emailToken}`);
      const data = await response.json() as any;

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          email: data.email,
          verifiedAt: data.verifiedAt
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Verification failed',
          error: data.error
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred during verification',
        error: 'Network error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader className="animate-spin" size={48} />;
    }
    
    if (result?.success) {
      return <CheckCircle size={48} color="var(--green-9)" />;
    }
    
    if (result?.error === 'Email already verified') {
      return <CheckCircle size={48} color="var(--green-9)" />;
    }
    
    return <XCircle size={48} color="var(--red-9)" />;
  };

  const getStatusColor = () => {
    if (isLoading) return 'gray';
    if (result?.success || result?.error === 'Email already verified') return 'green';
    return 'red';
  };

  const getStatusTitle = () => {
    if (isLoading) return t('verifyEmail.verifying', { defaultValue: 'Verifying Email...' });
    if (result?.success) return t('verifyEmail.success', { defaultValue: 'Email Verified!' });
    if (result?.error === 'Email already verified') return t('verifyEmail.alreadyVerified', { defaultValue: 'Already Verified' });
    return t('verifyEmail.failed', { defaultValue: 'Verification Failed' });
  };

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      <Container size="2" py="8">
        <Card style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem' }}>
          <Flex direction="column" align="center" gap="4" style={{ textAlign: 'center' }}>
            {getStatusIcon()}
            
            <Heading size="6" color={getStatusColor()}>
              {getStatusTitle()}
            </Heading>

            {isLoading && (
              <Text size="3" color="gray">
                {t('verifyEmail.pleaseWait', { defaultValue: 'Please wait while we verify your email address...' })}
              </Text>
            )}

            {result && !isLoading && (
              <>
                <Text size="3" color="gray" style={{ lineHeight: '1.6' }}>
                  {result.message}
                </Text>

                {result.email && (
                  <Box style={{ 
                    backgroundColor: 'var(--gray-3)', 
                    padding: '1rem', 
                    borderRadius: '6px',
                    border: '1px solid var(--gray-6)'
                  }}>
                    <Text size="2" color="gray" weight="medium">
                      {t('verifyEmail.email', { defaultValue: 'Email' })}: {result.email}
                    </Text>
                  </Box>
                )}

                {result.verifiedAt && (
                  <Text size="2" color="gray">
                    {t('verifyEmail.verifiedAt', { defaultValue: 'Verified at' })}: {new Date(result.verifiedAt).toLocaleString()}
                  </Text>
                )}

                {result.error && result.error !== 'Email already verified' && (
                  <Box style={{ 
                    backgroundColor: 'var(--red-3)', 
                    padding: '1rem', 
                    borderRadius: '6px',
                    border: '1px solid var(--red-6)',
                    marginTop: '1rem'
                  }}>
                    <Flex align="center" gap="2" justify="center">
                      <AlertCircle size={16} color="var(--red-9)" />
                      <Text size="2" color="red">
                        {result.error}
                      </Text>
                    </Flex>
                  </Box>
                )}

                <Flex gap="3" mt="4">
                  <Button asChild variant="solid" color="blue">
                    <Link href="/">
                      {t('verifyEmail.goHome', { defaultValue: 'Go to Homepage' })}
                    </Link>
                  </Button>
                  
                  {result.success && (
                    <Button asChild variant="outline">
                      <Link href="/harbor">
                        {t('verifyEmail.goToHarbor', { defaultValue: 'Go to Harbor' })}
                      </Link>
                    </Button>
                  )}
                </Flex>
              </>
            )}
          </Flex>
        </Card>
      </Container>
    </Box>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Heading, Text, Card, Button, Container, Separator } from '@radix-ui/themes';
import { CheckCircle, XCircle, AlertCircle, Loader, Mail, MailX } from 'lucide-react';
import Link from 'next/link';

interface UnsubscribeResult {
  success: boolean;
  message: string;
  email?: string;
  emailType?: string;
  handleId?: string;
  unsubscribedAt?: string;
  error?: string;
}

export default function UnsubscribePage() {
  const { t } = useTranslation('translations');
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const handleId = searchParams.get('handle');
  
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      processUnsubscribe(token);
    }
  }, [token]);

  const processUnsubscribe = async (unsubscribeToken: string) => {
    try {
      setIsLoading(true);
      const url = handleId 
        ? `/api/unsubscribe/${unsubscribeToken}?handle=${handleId}`
        : `/api/unsubscribe/${unsubscribeToken}`;
        
      const response = await fetch(url);
      const data = await response.json() as any;

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          email: data.email,
          emailType: data.emailType,
          handleId: data.handleId,
          unsubscribedAt: data.unsubscribedAt
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Unsubscribe failed',
          error: data.error
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred during unsubscribe',
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
      return <MailX size={48} color="var(--green-9)" />;
    }
    
    return <XCircle size={48} color="var(--red-9)" />;
  };

  const getStatusColor = () => {
    if (isLoading) return 'gray';
    if (result?.success) return 'green';
    return 'red';
  };

  const getStatusTitle = () => {
    if (isLoading) return t('unsubscribe.processing', { defaultValue: 'Processing Unsubscribe...' });
    if (result?.success) return t('unsubscribe.success', { defaultValue: 'Successfully Unsubscribed!' });
    return t('unsubscribe.failed', { defaultValue: 'Unsubscribe Failed' });
  };

  const getEmailTypeDescription = (emailType?: string) => {
    if (!emailType) return '';
    
    const typeMap: Record<string, string> = {
      'all': t('unsubscribe.types.all', { defaultValue: 'all emails' }),
      'newsletters': t('unsubscribe.types.newsletters', { defaultValue: 'newsletters' }),
      'announcements': t('unsubscribe.types.announcements', { defaultValue: 'announcements' }),
      'role_updates': t('unsubscribe.types.roleUpdates', { defaultValue: 'role updates' }),
      'tenant_updates': t('unsubscribe.types.tenantUpdates', { defaultValue: 'tenant updates' }),
      'workflow_updates': t('unsubscribe.types.workflowUpdates', { defaultValue: 'workflow updates' }),
      'handle_updates': t('unsubscribe.types.handleUpdates', { defaultValue: 'handle updates' }),
      'blog_updates': t('unsubscribe.types.blogUpdates', { defaultValue: 'blog updates' }),
      'content_updates': t('unsubscribe.types.contentUpdates', { defaultValue: 'content updates' }),
      'welcome': t('unsubscribe.types.welcome', { defaultValue: 'welcome emails' })
    };
    
    return typeMap[emailType] || emailType;
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
                {t('unsubscribe.pleaseWait', { defaultValue: 'Please wait while we process your unsubscribe request...' })}
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
                      {t('unsubscribe.email', { defaultValue: 'Email' })}: {result.email}
                    </Text>
                  </Box>
                )}

                {result.emailType && (
                  <Box style={{ 
                    backgroundColor: 'var(--blue-3)', 
                    padding: '1rem', 
                    borderRadius: '6px',
                    border: '1px solid var(--blue-6)'
                  }}>
                    <Text size="2" color="blue" weight="medium">
                      {t('unsubscribe.unsubscribedFrom', { defaultValue: 'Unsubscribed from' })}: {getEmailTypeDescription(result.emailType)}
                    </Text>
                  </Box>
                )}

                {result.handleId && (
                  <Box style={{ 
                    backgroundColor: 'var(--purple-3)', 
                    padding: '1rem', 
                    borderRadius: '6px',
                    border: '1px solid var(--purple-6)'
                  }}>
                    <Text size="2" color="purple" weight="medium">
                      {t('unsubscribe.handleSpecific', { defaultValue: 'Handle-specific emails' })}
                    </Text>
                  </Box>
                )}

                {result.unsubscribedAt && (
                  <Text size="2" color="gray">
                    {t('unsubscribe.unsubscribedAt', { defaultValue: 'Unsubscribed at' })}: {new Date(result.unsubscribedAt).toLocaleString()}
                  </Text>
                )}

                {result.error && (
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

                <Separator style={{ margin: '1rem 0' }} />

                <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
                  {t('unsubscribe.info', { defaultValue: 'You can always manage your email preferences or resubscribe by visiting your Harbor dashboard.' })}
                </Text>

                <Flex gap="3" mt="4">
                  <Button asChild variant="solid" color="blue">
                    <Link href="/">
                      {t('unsubscribe.goHome', { defaultValue: 'Go to Homepage' })}
                    </Link>
                  </Button>
                  
                  {result.success && (
                    <Button asChild variant="outline">
                      <Link href="/harbor">
                        {t('unsubscribe.managePreferences', { defaultValue: 'Manage Preferences' })}
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

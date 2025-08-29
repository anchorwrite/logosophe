'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Box, Flex, Heading, Text, Card, Switch, Separator, Badge } from '@radix-ui/themes';

interface EmailPreferences {
  newsletters: boolean;
  announcements: boolean;
  role_updates: boolean;
  tenant_updates: boolean;
  workflow_updates: boolean;
  handle_updates: boolean;
  blog_updates: boolean;
  content_updates: boolean;
  welcome: boolean;
}

interface HandleEmailPreferences {
  handleId: number;
  handleName: string;
  handleDescription?: string;
  handle_updates: boolean;
  blog_updates: boolean;
  content_updates: boolean;
  announcements: boolean;
}

interface EmailPreferencesManagerProps {
  subscriberEmail: string;
}

export default function EmailPreferencesManager({ subscriberEmail }: EmailPreferencesManagerProps) {
  const { t } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    newsletters: true,
    announcements: true,
    role_updates: true,
    tenant_updates: true,
    workflow_updates: true,
    handle_updates: true,
    blog_updates: true,
    content_updates: true,
    welcome: true
  });
  const [handlePreferences, setHandlePreferences] = useState<HandleEmailPreferences[]>([]);
  const [isLoadingHandles, setIsLoadingHandles] = useState(true);

  // Load email preferences
  useEffect(() => {
    loadEmailPreferences();
  }, [subscriberEmail]);

  // Load handle-specific preferences
  useEffect(() => {
    loadHandlePreferences();
  }, [subscriberEmail]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadEmailPreferences = async () => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/email-preferences`);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
      setMessage({
        type: 'error',
        text: t('profile.emailPreferences.loadError', { defaultValue: 'Failed to load email preferences' })
      });
    }
  };

  const loadHandlePreferences = async () => {
    try {
      setIsLoadingHandles(true);
      // First get the subscriber's handles
      const handlesResponse = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles`);
      if (handlesResponse.ok) {
        const handlesData = await handlesResponse.json() as any;
        if (handlesData.handles && Array.isArray(handlesData.handles)) {
          // Load preferences for each handle
          const handlePrefs: HandleEmailPreferences[] = [];
          for (const handle of handlesData.handles) {
            try {
              const prefResponse = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${handle.Id}/email-preferences`);
              if (prefResponse.ok) {
                const prefData = await prefResponse.json() as any;
                handlePrefs.push({
                  handleId: handle.Id,
                  handleName: handle.DisplayName,
                  handleDescription: handle.Description,
                  handle_updates: prefData.preferences?.handle_updates ?? true,
                  blog_updates: prefData.preferences?.blog_updates ?? true,
                  content_updates: prefData.preferences?.content_updates ?? true,
                  announcements: prefData.preferences?.announcements ?? true
                });
              }
            } catch (error) {
              console.error(`Error loading preferences for handle ${handle.Id}:`, error);
            }
          }
          setHandlePreferences(handlePrefs);
        }
      }
    } catch (error) {
      console.error('Error loading handle preferences:', error);
    } finally {
      setIsLoadingHandles(false);
    }
  };

  const handlePreferenceToggle = async (emailType: keyof EmailPreferences, enabled: boolean) => {
    try {
      setIsLoading(true);
      const updatedPreferences = { ...preferences, [emailType]: enabled };
      
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/email-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: updatedPreferences
        }),
      });

      if (response.ok) {
        setPreferences(updatedPreferences);
        setMessage({
          type: 'success',
          text: t('profile.emailPreferences.updateSuccess', { defaultValue: 'Email preferences updated successfully' })
        });
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating email preferences:', error);
              setMessage({
          type: 'error',
          text: t('profile.emailPreferences.updateError', { defaultValue: 'Failed to update email preferences' })
        });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHandlePreferenceToggle = async (handleId: number, emailType: keyof Omit<HandleEmailPreferences, 'handleId' | 'handleName' | 'handleDescription'>, enabled: boolean) => {
    try {
      setIsLoading(true);
      const updatedHandlePrefs = handlePreferences.map(pref => 
        pref.handleId === handleId 
          ? { ...pref, [emailType]: enabled }
          : pref
      );
      
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${handleId}/email-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: {
            handle_updates: updatedHandlePrefs.find(p => p.handleId === handleId)?.handle_updates ?? true,
            blog_updates: updatedHandlePrefs.find(p => p.handleId === handleId)?.blog_updates ?? true,
            content_updates: updatedHandlePrefs.find(p => p.handleId === handleId)?.content_updates ?? true,
            announcements: updatedHandlePrefs.find(p => p.handleId === handleId)?.announcements ?? true
          }
        }),
      });

      if (response.ok) {
        setHandlePreferences(updatedHandlePrefs);
        setMessage({
          type: 'success',
          text: t('harbor.media.emailPreferences.handleUpdateSuccess', { defaultValue: 'Handle preferences updated successfully' })
        });
      } else {
        throw new Error('Failed to update handle preferences');
      }
    } catch (error) {
      console.error('Error updating handle preferences:', error);
              setMessage({
          type: 'error',
          text: t('profile.emailPreferences.handleUpdateError', { defaultValue: 'Failed to update handle preferences' })
        });
    } finally {
      setIsLoading(false);
    }
  };

  const formatEmailType = (type: string): string => {
    const typeMap: Record<string, string> = {
      newsletters: t('profile.emailPreferences.types.newsletters'),
      announcements: t('profile.emailPreferences.types.announcements'),
      role_updates: t('profile.emailPreferences.types.roleUpdates'),
      tenant_updates: t('profile.emailPreferences.types.tenantUpdates'),
      workflow_updates: t('profile.emailPreferences.types.workflowUpdates'),
      handle_updates: t('profile.emailPreferences.types.handleUpdates'),
      blog_updates: t('profile.emailPreferences.types.blogUpdates'),
      content_updates: t('profile.emailPreferences.types.contentUpdates'),
      welcome: t('profile.emailPreferences.types.welcome')
    };
    return typeMap[type] || type;
  };

  const formatHandleEmailType = (type: string): string => {
    const typeMap: Record<string, string> = {
      handle_updates: t('profile.emailPreferences.types.handleUpdates'),
      blog_updates: t('profile.emailPreferences.types.blogUpdates'),
      content_updates: t('profile.emailPreferences.types.contentUpdates'),
      announcements: t('profile.emailPreferences.types.announcements')
    };
    return typeMap[type] || type;
  };

  return (
    <Box style={{ width: '100%' }}>
      {/* Message Display */}
      {message && (
        <Card style={{ 
          marginBottom: '1rem', 
          backgroundColor: message.type === 'success' ? 'var(--green-3)' : 'var(--red-3)',
          border: `1px solid ${message.type === 'success' ? 'var(--green-6)' : 'var(--red-6)'}`
        }}>
          <Box style={{ padding: '1rem' }}>
            <Text 
              size="3" 
              color={message.type === 'success' ? 'green' : 'red'}
              weight="medium"
            >
              {message.text}
            </Text>
          </Box>
        </Card>
      )}

      {/* General Email Preferences */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            {t('profile.emailPreferences.title', { defaultValue: 'Email Preferences' })}
          </Heading>
          <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
            {t('profile.emailPreferences.description', { defaultValue: 'Choose which types of emails you\'d like to receive from Logosophe:' })}
          </Text>
          
          <Flex direction="column" gap="3">
            {Object.entries(preferences).map(([type, enabled]) => (
              <Flex key={type} justify="between" align="start" style={{ padding: '0.75rem', border: '1px solid var(--gray-6)', borderRadius: '6px' }}>
                <Box style={{ flex: 1 }}>
                  <Text size="3" weight="medium" style={{ marginBottom: '0.5rem' }}>
                    {formatEmailType(type)}: 
                  </Text>
                  <Text size="2" color="gray">
                    {t(`profile.emailPreferences.descriptions.${type}`, { 
                      defaultValue: type === 'newsletters' ? 'Regular newsletter content' :
                      type === 'announcements' ? 'System announcements and updates' :
                      type === 'role_updates' ? 'Role assignment and permission changes' :
                      type === 'tenant_updates' ? 'Tenant-specific news and updates' :
                      type === 'workflow_updates' ? 'Workflow-related notifications' :
                      type === 'handle_updates' ? 'Handle-specific content updates' :
                      type === 'blog_updates' ? 'Blog post notifications' :
                      type === 'content_updates' ? 'New content published notifications' :
                      type === 'welcome' ? 'Welcome emails for new subscribers' :
                      'Email updates'
                    })}
                  </Text>
                </Box>
                <Switch 
                  checked={enabled} 
                  onCheckedChange={(checked) => handlePreferenceToggle(type as keyof EmailPreferences, checked)}
                  disabled={isLoading}
                  style={{ marginLeft: '1rem' }}
                />
              </Flex>
            ))}
          </Flex>
        </Box>
      </Card>

      {/* Handle-Specific Email Preferences */}
      {handlePreferences.length > 0 && (
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              {t('profile.emailPreferences.handleTitle', { defaultValue: 'Handle-Specific Email Preferences' })}
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
                              {t('profile.emailPreferences.handleDescription', { defaultValue: 'Choose which updates you\'d like to receive for each of your public handles:' })}
            </Text>
            
            {isLoadingHandles ? (
              <Text color="gray" size="2">
                {t('common.loading', { defaultValue: 'Loading...' })}
              </Text>
            ) : (
              <Flex direction="column" gap="4">
                {handlePreferences.map((handlePref) => (
                  <Box key={handlePref.handleId} style={{ border: '1px solid var(--gray-6)', borderRadius: '8px', padding: '1rem' }}>
                    <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                      <Box>
                        <Heading size="3" style={{ marginBottom: '0.5rem' }}>
                          {handlePref.handleName}
                        </Heading>
                        {handlePref.handleDescription && (
                          <Text size="2" color="gray" style={{ marginBottom: '0.5rem' }}>
                            {handlePref.handleDescription}
                          </Text>
                        )}
                        <Badge variant="soft" color="blue">
                          {t('profile.emailPreferences.handle', { defaultValue: 'Handle' })}
                        </Badge>
                      </Box>
                    </Flex>
                    
                    <Separator style={{ margin: '1rem 0' }} />
                    
                    <Flex direction="column" gap="3">
                      {Object.entries(handlePref).filter(([key]) => !['handleId', 'handleName', 'handleDescription'].includes(key)).map(([type, enabled]) => (
                        <Flex key={type} justify="between" align="start" style={{ padding: '0.5rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                          <Box style={{ flex: 1 }}>
                            <Text size="2" weight="medium" style={{ marginBottom: '0.25rem' }}>
                              {formatHandleEmailType(type)}: 
                            </Text>
                            <Text size="1" color="gray">
                              {type === 'handle_updates' ? 'Updates about this handle\'s content and settings' :
                               type === 'blog_updates' ? 'New blog posts and blog-related notifications' :
                               type === 'content_updates' ? 'New content published to this handle' :
                               type === 'announcements' ? 'Handle-specific announcements and news' :
                               'Handle updates'}
                            </Text>
                          </Box>
                          <Switch 
                            checked={enabled} 
                            onCheckedChange={(checked) => handleHandlePreferenceToggle(handlePref.handleId, type as any, checked)}
                            disabled={isLoading}
                            style={{ marginLeft: '1rem' }}
                          />
                        </Flex>
                      ))}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            )}
          </Box>
        </Card>
      )}

      {/* No Handles Message */}
      {!isLoadingHandles && handlePreferences.length === 0 && (
        <Card>
          <Box style={{ padding: '1.5rem', textAlign: 'center' }}>
            <Text color="gray" size="2">
                              {t('profile.emailPreferences.noHandles', { defaultValue: 'You don\'t have any public handles yet. Create a handle to receive handle-specific email updates.' })}
            </Text>
          </Box>
        </Card>
      )}
    </Box>
  );
}

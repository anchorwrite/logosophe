'use client';

import React, { useState, useCallback } from 'react';
import { Box, Flex, Text, Button, TextField, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface Link {
  url: string;
  title: string;
  domain: string;
  description?: string;
  imageUrl?: string;
}

interface MessageLinkSharingProps {
  links: Link[];
  onLinksChange: (links: Link[]) => void;
  maxLinks?: number;
  disabled?: boolean;
  lang: string;
}

export const MessageLinkSharing: React.FC<MessageLinkSharingProps> = ({
  links,
  onLinksChange,
  maxLinks = 5,
  disabled = false,
  lang
}) => {
  const { t } = useTranslation('translations');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const addLink = useCallback(async () => {
    if (!linkUrl.trim()) return;

    try {
      setIsProcessing(true);
      
      // Basic URL validation
      const url = new URL(linkUrl);
      const domain = url.hostname;
      
      // Try to fetch link metadata
      let title = domain;
      let description = '';
      let imageUrl = '';

      try {
        // In a real implementation, you might want to use a service like OpenGraph or similar
        // For now, we'll use the domain as the title
        title = domain;
      } catch (error) {
        console.error('Error fetching link metadata:', error);
      }

      const newLink: Link = {
        url: linkUrl.trim(),
        title,
        domain,
        description,
        imageUrl
      };

      const updatedLinks = [...links, newLink];
      onLinksChange(updatedLinks);
      
      setLinkUrl('');
      setShowLinkInput(false);
    } catch (error) {
      console.error('Invalid URL:', error);
      // You might want to show an error message to the user
    } finally {
      setIsProcessing(false);
    }
  }, [linkUrl, links, onLinksChange]);

  const removeLink = useCallback((index: number) => {
    const updatedLinks = links.filter((_, i) => i !== index);
    onLinksChange(updatedLinks);
  }, [links, onLinksChange]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addLink();
    }
  }, [addLink]);

  const canAddLink = links.length < maxLinks && !isProcessing;

  return (
    <Box className="message-link-sharing">
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Text size="2" weight="bold">{t('messaging.links')}</Text>
          <Flex align="center" gap="2">
            <Text size="1" color="gray">
              {links.length}/{maxLinks}
            </Text>
            {canAddLink && (
              <Button
                variant="soft"
                size="1"
                onClick={() => setShowLinkInput(true)}
                disabled={disabled}
              >
                🔗 {t('messaging.addLink')}
              </Button>
            )}
          </Flex>
        </Flex>

        {/* Link Input */}
        {showLinkInput && canAddLink && (
          <Box p="3" style={{
            border: '1px solid var(--gray-6)',
            borderRadius: 'var(--radius-3)',
            backgroundColor: 'var(--gray-1)'
          }}>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Add a link</Text>
              <Flex gap="2">
                <TextField.Root style={{ flex: 1 }}>
                  <TextField.Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    onKeyPress={handleKeyPress}
                    disabled={isProcessing}
                  />
                </TextField.Root>
                <Button
                  onClick={addLink}
                  disabled={!linkUrl.trim() || isProcessing}
                  size="2"
                >
                  {isProcessing ? 'Adding...' : 'Add'}
                </Button>
                <Button
                  variant="soft"
                  onClick={() => {
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }}
                  disabled={isProcessing}
                  size="2"
                >
                  Cancel
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}

        {/* Links List */}
        {links.length > 0 && (
          <Flex direction="column" gap="2">
            {links.map((link, index) => (
              <Box
                key={index}
                p="3"
                style={{
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-3)',
                  backgroundColor: 'var(--gray-1)'
                }}
              >
                <Flex align="center" gap="2" justify="between">
                  <Flex align="center" gap="2" style={{ flex: 1 }}>
                    <span className="text-blue-600">🔗</span>
                    
                    <Flex direction="column" gap="1" style={{ flex: 1 }}>
                      <Text size="2" weight="medium" style={{ color: 'var(--gray-12)' }}>
                        {link.title}
                      </Text>
                      <Text size="1" color="gray" style={{ wordBreak: 'break-all' }}>
                        {link.url}
                      </Text>
                      {link.description && (
                        <Text size="1" color="gray">
                          {link.description}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                  
                  <Flex align="center" gap="2">
                    <Badge variant="soft" size="1">
                      {link.domain}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="1"
                      onClick={() => removeLink(index)}
                      disabled={disabled}
                      style={{ color: 'var(--red-9)' }}
                    >
                      🗑️
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
};

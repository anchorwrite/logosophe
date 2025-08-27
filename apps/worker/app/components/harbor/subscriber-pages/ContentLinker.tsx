'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Text, TextField, Card, Flex, Badge, Dialog } from '@radix-ui/themes';
import { Search, Link, X, FileText, Image, Video, Music } from 'lucide-react';

interface PublishedContent {
  id: number;
  mediaId: number;
  title: string;
  description: string;
  mediaType: string;
  fileSize: number;
  language: string;
  form: string;
  genre: string;
  publisher: {
    email: string;
    name: string;
  };
  publishedAt: string;
  accessToken: string;
}

interface ContentLinkerProps {
  onContentSelected: (content: PublishedContent) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function ContentLinker({ onContentSelected, onClose, isOpen }: ContentLinkerProps) {
  const { t } = useTranslation('translations');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublishedContent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchContent = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/harbor/content/search?q=${encodeURIComponent(query)}&limit=20`);
      
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: PublishedContent[]; error?: string };
        if (data.success) {
          setSearchResults(data.data);
        } else {
          setError(data.error || 'Failed to search content');
        }
      } else {
        setError('Failed to search content');
      }
    } catch (error) {
      console.error('Error searching content:', error);
      setError('Failed to search content');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchContent(searchQuery);
  };

  const handleContentSelect = (content: PublishedContent) => {
    onContentSelected(content);
    onClose();
  };

  const getMediaTypeIcon = (mediaType: string) => {
    if (mediaType.startsWith('image/')) return <Image size={16} />;
    if (mediaType.startsWith('video/')) return <Video size={16} />;
    if (mediaType.startsWith('audio/')) return <Music size={16} />;
    return <FileText size={16} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content style={{ maxWidth: '800px', maxHeight: '80vh' }}>
        <Dialog.Title>
          <Flex align="center" gap="2">
            <Link size={20} />
            {t('subscriber_pages.content_linker.title')}
          </Flex>
        </Dialog.Title>

        <Box mt="4">
          <form onSubmit={handleSearch}>
            <Flex gap="2">
              <TextField.Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('subscriber_pages.content_linker.search_placeholder')}
                style={{ flex: 1 }}
              />
              <Button type="submit" disabled={isSearching}>
                <Search size={16} />
                {isSearching ? t('common.searching') : t('common.search')}
              </Button>
            </Flex>
          </form>
        </Box>

        {error && (
          <Box mt="3" p="3" style={{ backgroundColor: 'var(--red-2)', borderRadius: 'var(--radius-2)' }}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        <Box mt="4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {searchResults.length > 0 ? (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {searchResults.map((content) => (
                <Card key={content.id} style={{ cursor: 'pointer' }} onClick={() => handleContentSelect(content)}>
                  <Box p="3">
                    <Flex justify="between" align="start" mb="2">
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" gap="2" mb="1">
                          {getMediaTypeIcon(content.mediaType)}
                          <Text weight="bold" size="3">
                            {content.title}
                          </Text>
                        </Flex>
                        
                        {content.description && (
                          <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                            {content.description}
                          </Text>
                        )}

                        <Flex gap="2" align="center" mb="2">
                          {content.form && (
                            <Badge color="blue">{content.form}</Badge>
                          )}
                          {content.genre && (
                            <Badge color="green">{content.genre}</Badge>
                          )}
                          <Badge color="orange">{content.language.toUpperCase()}</Badge>
                          <Text size="1" color="gray">
                            {formatFileSize(content.fileSize)}
                          </Text>
                        </Flex>

                        <Flex gap="2" align="center">
                          <Text size="1" color="gray">
                            {t('subscriber_pages.content_linker.published_by')}: {content.publisher.name}
                          </Text>
                          <Text size="1" color="gray">
                            {t('subscriber_pages.content_linker.published_on')}: {formatDate(content.publishedAt)}
                          </Text>
                        </Flex>
                      </Box>
                      
                      <Button variant="soft" size="1">
                        <Link size={14} />
                        {t('subscriber_pages.content_linker.link_content')}
                      </Button>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : searchQuery && !isSearching ? (
            <Box p="6" style={{ textAlign: 'center' }}>
              <Text color="gray">{t('subscriber_pages.content_linker.no_results')}</Text>
            </Box>
          ) : null}
        </Box>

        <Flex gap="3" mt="6" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t('common.cancel')}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

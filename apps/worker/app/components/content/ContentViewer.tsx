'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, Text, Button, Flex, Badge, Heading } from '@radix-ui/themes';
import { ArrowLeft, Download, Eye, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContentAboutModal } from './ContentAboutModal';

interface PublishedContent {
  Id: string;
  MediaId: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  Language?: string;
  FormId?: string;
  GenreId?: string;
  FormName?: string;
  GenreName?: string;
  PublisherId: string;
  PublishedAt: string;
  PublishingSettings: string;
}

interface MediaFile {
  Id: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  Language?: string;
}

interface ContentViewResponse {
  content: PublishedContent;
  media: MediaFile;
  mediaUrl: string;
  publishingSettings: {
    watermark?: boolean;
    disableCopy?: boolean;
    disableDownload?: boolean;
    addWatermark?: boolean;
  };
}

interface ContentViewerProps {
  token: string;
  lang: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function ContentViewer({ token, lang }: ContentViewerProps) {
  const { t } = useTranslation('translations');
  const router = useRouter();
  const { data: session } = useSession();
  const [content, setContent] = useState<ContentViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscriber, setIsSubscriber] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/content/${token}/view`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch content');
        }

        const data = await response.json() as ContentViewResponse;
        setContent(data);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const checkSubscriberStatus = async () => {
      if (session?.user?.email) {
        try {
                  const response = await fetch('/api/auth/subscriber-status');
        if (response.ok) {
          const data = await response.json() as { isSubscriber: boolean };
          setIsSubscriber(data.isSubscriber || false);
        }
        } catch (err) {
          console.error('Error checking subscriber status:', err);
        }
      }
    };

    fetchContent();
    checkSubscriberStatus();
  }, [token, session?.user?.email]);

  const handleBack = () => {
    router.back();
  };

  const handleDownload = () => {
    // Create a temporary link element to trigger download without opening a tab
    const downloadUrl = `/api/content/${token}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = content?.content.FileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = () => {
    // Use token-based preview URL for browser display
    const viewUrl = `/api/content/${token}/preview`;
    window.open(viewUrl, '_blank');
  };

  if (loading) {
    return (
      <Box p="4">
        <Text>{t('content.loading')}</Text>
      </Box>
    );
  }

  if (error || !content) {
    return (
      <Box p="4">
        <Text color="red">{error || t('content.errorLoading')}</Text>
      </Box>
    );
  }

  const { content: publishedContent, media, publishingSettings } = content;

  return (
    <Box p="4">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Button variant="soft" onClick={handleBack}>
            <ArrowLeft size="16" />
            {t('content.back')}
          </Button>
          
          <Flex gap="2">
            <Button variant="soft" onClick={handleDownload}>
              <Download size="16" />
              {t('content.download')}
            </Button>
            <ContentAboutModal content={publishedContent} media={media}>
              <Button variant="soft">
                <Info size="16" />
                {t('content.about')}
              </Button>
            </ContentAboutModal>
          </Flex>
        </Flex>

        {/* Content Info */}
        <Card>
          <Box p="4">
            <Flex direction="column" gap="3">
              {/* Title and Type */}
              <Flex justify="between" align="center">
                <Heading size="4">{publishedContent.FileName}</Heading>
                <Badge color={publishedContent.MediaType === 'document' ? 'orange' : 'blue'}>
                  {t(`content.${publishedContent.MediaType || 'document'}`)}
                </Badge>
              </Flex>

              {/* Metadata */}
              <Flex direction="column" gap="2">
                <Text size="2" color="gray">
                  {formatBytes(media.FileSize)} • {formatDate(publishedContent.PublishedAt)}
                </Text>
                
                {publishedContent.FormName && (
                  <Text size="2" color="gray">
                    {t('content.form')}: {publishedContent.FormName}
                  </Text>
                )}
                
                {publishedContent.GenreName && (
                  <Text size="2" color="gray">
                    {t('content.genre')}: {publishedContent.GenreName}
                  </Text>
                )}

                {publishedContent.Language && publishedContent.Language !== 'en' && (
                  <Text size="2" color="gray">
                    {t('content.language')}: {publishedContent.Language.toUpperCase()}
                  </Text>
                )}
              </Flex>

              {/* Protection Status */}
              {publishingSettings.watermark && !isSubscriber && (
                <Box p="3" style={{ 
                  backgroundColor: '#fef3c7', 
                  border: '1px solid #f59e0b',
                  borderRadius: '6px'
                }}>
                  <Text size="2" color="amber">
                    {t('content.protectionNotice')}
                  </Text>
                </Box>
              )}

              {isSubscriber && (
                <Box p="3" style={{ 
                  backgroundColor: '#d1fae5', 
                  border: '1px solid #10b981',
                  borderRadius: '6px'
                }}>
                  <Text size="2" color="green">
                    {t('content.subscriberAccess')}
                  </Text>
                </Box>
              )}
            </Flex>
          </Box>
        </Card>

        {/* Content Viewer */}
        <Card>
          <Box p="4">
            <Flex direction="column" gap="3">
              <Text weight="bold">{t('content.preview')}</Text>
              
              {/* Content Display */}
              <Box style={{ 
                minHeight: '400px', 
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
              }}>
                {publishedContent.MediaType === 'image' ? (
                  <img 
                    src={content.mediaUrl} 
                    alt={publishedContent.FileName}
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                  />
                ) : publishedContent.MediaType === 'video' ? (
                  <video 
                    controls 
                    src={content.mediaUrl}
                    style={{ maxWidth: '100%', maxHeight: '400px' }}
                  >
                    {t('content.videoNotSupported')}
                  </video>
                ) : publishedContent.MediaType === 'audio' ? (
                  <audio 
                    controls 
                    src={content.mediaUrl}
                    style={{ width: '100%' }}
                  >
                    {t('content.audioNotSupported')}
                  </audio>
                ) : (
                  <Flex direction="column" align="center" gap="2">
                    <Text color="gray">{t('content.documentPreview')}</Text>
                    <Flex gap="2">
                      <Button onClick={handleDownload}>
                        <Download size="16" />
                        {t('content.download')}
                      </Button>
                      <Button variant="soft" onClick={handleView}>
                        <Eye size="16" />
                        {t('content.view')}
                      </Button>
                    </Flex>
                  </Flex>
                )}
              </Box>
            </Flex>
          </Box>
        </Card>
      </Flex>
    </Box>
  );
} 
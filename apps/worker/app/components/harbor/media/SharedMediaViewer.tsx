'use client';

import { useEffect, useState } from 'react';
import { Box, Flex, Text, Button, Card, Dialog } from '@radix-ui/themes';
import { Download, Eye, Trash2, Share2, Users, Minus, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface SharedMedia {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  mediaType: 'audio' | 'video' | 'image' | 'document';
  uploadDate: string;
  description?: string;
  duration?: number;
  width?: number;
  height?: number;
  shareUrl?: string;
  expiresAt?: string;
  maxAccesses?: number;
  currentAccesses: number;
  isPasswordProtected: boolean;
}

interface SharedMediaViewerProps {
  shareToken: string;
}

export function SharedMediaViewer({ shareToken }: SharedMediaViewerProps) {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const [media, setMedia] = useState<SharedMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    fetchSharedMedia();
  }, [shareToken]);

  const fetchSharedMedia = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/media/share/${shareToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setShowPasswordDialog(true);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch shared media: ${errorText}`);
      }

      const data = await response.json() as SharedMedia;
      setMedia(data);
    } catch (err) {
      console.error('Error fetching shared media:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shared media');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const response = await fetch(`/api/media/share/${shareToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Invalid password');
      }

      const data = await response.json() as SharedMedia;
      setMedia(data);
      setShowPasswordDialog(false);
      setPassword('');
    } catch (err) {
      console.error('Error submitting password:', err);
      setError('Invalid password');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        type: 'success',
        title: 'Success',
        content: t('media.linkCopied')
      });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      showToast({
        type: 'error',
        title: 'Error',
        content: t('media.copyFailed')
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMediaContent = () => {
    if (!media) return null;

    switch (media.mediaType) {
      case 'image':
        return (
          <img
            src={`/api/media/${media.id}/preview?shareToken=${shareToken}`}
            alt={media.fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '60vh',
              objectFit: 'contain'
            }}
          />
        );
      
      case 'video':
        return (
          <video
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '60vh'
            }}
          >
            <source src={`/api/media/${media.id}/preview?shareToken=${shareToken}`} type={media.contentType} />
            {t('media.videoNotSupported')}
          </video>
        );
      
      case 'audio':
        return (
          <audio
            controls
            style={{
              width: '100%',
              maxWidth: '500px'
            }}
          >
            <source src={`/api/media/${media.id}/preview?shareToken=${shareToken}`} type={media.contentType} />
            {t('media.audioNotSupported')}
          </audio>
        );
      
      case 'document':
        return (
          <Box p="4" style={{ textAlign: 'center' }}>
            <Text size="4" mb="2">{media.fileName}</Text>
            <Text color="gray" mb="4">
              {t('media.documentPreview')}
            </Text>
          </Box>
        );
      
      default:
        return (
          <Box p="4" style={{ textAlign: 'center' }}>
            <Text color="gray">{t('media.unsupportedType')}</Text>
          </Box>
        );
    }
  };

  if (loading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="gray">{t('media.loading')}</Text>
      </Box>
    );
  }

  if (error && !showPasswordDialog) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="red" mb="2">{error}</Text>
        <Button onClick={fetchSharedMedia}>
          {t('media.tryAgain')}
        </Button>
      </Box>
    );
  }

  if (showPasswordDialog) {
    return (
      <Dialog.Root open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <Dialog.Content>
          <Dialog.Title>{t('media.passwordRequired')}</Dialog.Title>
          <Dialog.Description>
            {t('media.enterPassword')}
          </Dialog.Description>
          <Box mt="4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('media.password')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--gray-6)',
                borderRadius: 'var(--radius-2)',
                fontSize: '14px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
            />
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" onClick={() => setShowPasswordDialog(false)}>
              {t('media.cancel')}
            </Button>
            <Button onClick={handlePasswordSubmit}>
              {t('media.submit')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    );
  }

  if (!media) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="gray">{t('media.mediaNotFound')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <Box p="6">
          <Flex direction="column" gap="4">
            <Box>
              {renderMediaContent()}
            </Box>
            
            <Box p="4" style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-2)' }}>
              <Flex direction="column" gap="2">
                <Flex justify="between">
                  <Text size="2" color="gray">{t('media.fileName')}:</Text>
                  <Text size="2">{media.fileName}</Text>
                </Flex>
                <Flex justify="between">
                  <Text size="2" color="gray">{t('media.fileSize')}:</Text>
                  <Text size="2">{formatBytes(media.fileSize)}</Text>
                </Flex>
                <Flex justify="between">
                  <Text size="2" color="gray">{t('media.mediaType')}:</Text>
                  <Text size="2" className="capitalize">{media.mediaType}</Text>
                </Flex>
                {media.duration && (
                  <Flex justify="between">
                    <Text size="2" color="gray">{t('media.duration')}:</Text>
                    <Text size="2">{formatDuration(media.duration)}</Text>
                  </Flex>
                )}
                {media.width && media.height && (
                  <Flex justify="between">
                    <Text size="2" color="gray">{t('media.dimensions')}:</Text>
                    <Text size="2">{media.width} × {media.height}</Text>
                  </Flex>
                )}
                <Flex justify="between">
                  <Text size="2" color="gray">{t('media.uploadDate')}:</Text>
                  <Text size="2">{formatDate(media.uploadDate)}</Text>
                </Flex>
                {media.description && (
                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">{t('media.description')}:</Text>
                    <Text size="2">{media.description}</Text>
                  </Flex>
                )}
                {media.expiresAt && (
                  <Flex justify="between">
                    <Text size="2" color="gray">{t('media.expiresAt')}:</Text>
                    <Text size="2">{formatDate(media.expiresAt)}</Text>
                  </Flex>
                )}
                {media.maxAccesses && (
                  <Flex justify="between">
                    <Text size="2" color="gray">{t('media.accesses')}:</Text>
                    <Text size="2">{media.currentAccesses} // {media.maxAccesses}</Text>
                  </Flex>
                )}
              </Flex>
            </Box>
            
            <Flex gap="2" justify="center" wrap="wrap">
              <Button asChild>
                <a href={`/api/media/share/${shareToken}/download`} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2" />
                  {t('media.download')}
                </a>
              </Button>
              {media.shareUrl && (
                <>
                  <Button variant="soft" onClick={() => copyToClipboard(media.shareUrl!)}>
                    <Copy className="mr-2" />
                    {t('media.copyLink')}
                  </Button>
                  <Button variant="soft" asChild>
                    <a href={media.shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2" />
                      {t('media.openLink')}
                    </a>
                  </Button>
                </>
              )}
            </Flex>
          </Flex>
        </Box>
      </Card>

    </Box>
  );
} 
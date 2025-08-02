'use client';

import { Dialog, Box, Flex, Text, Button } from '@radix-ui/themes';
import { X, Download, Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Media {
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
}

interface MediaPreviewProps {
  media: Media;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaPreview({ media, open, onOpenChange }: MediaPreviewProps) {
  const { t } = useTranslation('translations');

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

  const renderMediaContent = () => {
    switch (media.mediaType) {
      case 'image':
        return (
          <img
            src={`/api/media/${media.id}/preview`}
            alt={media.fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
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
              maxHeight: '70vh'
            }}
          >
            <source src={`/api/media/${media.id}/preview`} type={media.contentType} />
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
            <source src={`/api/media/${media.id}/preview`} type={media.contentType} />
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
            <Button asChild>
              <a href={`/api/media/${media.id}/download`} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2" />
                {t('media.downloadDocument')}
              </a>
            </Button>
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: 'auto',
        height: 'auto'
      }}>
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="bold">{media.fileName}</Text>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </Flex>
        
        <Box mb="4">
          {renderMediaContent()}
        </Box>
        
        <Box p="4" style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-2)' }}>
          <Flex direction="column" gap="2">
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
              <Text size="2">{new Date(media.uploadDate).toLocaleString()}</Text>
            </Flex>
            {media.description && (
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">{t('media.description')}:</Text>
                <Text size="2">{media.description}</Text>
              </Flex>
            )}
          </Flex>
        </Box>
        
        <Flex gap="2" justify="end">
          <Button variant="soft" asChild>
            <a href={`/api/media/${media.id}/download`} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2" />
              {t('media.download')}
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {t('media.close')}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
} 
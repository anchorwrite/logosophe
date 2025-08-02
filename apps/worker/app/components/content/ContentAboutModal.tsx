'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogTrigger,
  Box, 
  Flex, 
  Text, 
  Badge, 
  Separator,
  Button
} from '@radix-ui/themes';
import { Info, FileText, User, Calendar, Download, Eye, Tag, Globe } from 'lucide-react';

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
  AccessToken?: string;
  ViewCount?: number;
  DownloadCount?: number;
  PublisherName?: string;
}

interface ContentAboutModalProps {
  content: PublishedContent;
  media: MediaFile;
  children: React.ReactNode;
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getMediaTypeColor(mediaType: string): "blue" | "green" | "purple" | "orange" | "gray" {
  switch (mediaType) {
    case 'document': return 'blue';
    case 'image': return 'green';
    case 'video': return 'purple';
    case 'audio': return 'orange';
    default: return 'gray';
  }
}

export function ContentAboutModal({ content, media, children }: ContentAboutModalProps) {
  const { t } = useTranslation('translations');
  const [open, setOpen] = useState(false);

  const publishingSettings = content.PublishingSettings ? JSON.parse(content.PublishingSettings) : {};

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {children}
      </DialogTrigger>
      <DialogContent size="3" style={{ maxWidth: '600px' }}>
        <DialogTitle>
          <Flex align="center" gap="2">
            <Info size="20" />
            {t('content.about')}
          </Flex>
        </DialogTitle>

        <Box style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Flex direction="column" gap="4">
            
            {/* Basic Information */}
            <Box>
              <Text size="4" weight="bold" mb="2">
                {t('content.basicInformation')}
              </Text>
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.fileName')}:</Text>
                  <Text size="2" weight="medium">{media.FileName}</Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.fileSize')}:</Text>
                  <Text size="2">{formatBytes(media.FileSize)}</Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.contentType')}:</Text>
                  <Flex align="center" gap="1">
                    <Badge color={getMediaTypeColor(media.MediaType)}>
                      {t(`content.${media.MediaType}`)}
                    </Badge>
                  </Flex>
                </Flex>
                {media.Language && (
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">{t('content.language')}:</Text>
                    <Flex align="center" gap="1">
                      <Globe size="14" />
                      <Text size="2">{media.Language.toUpperCase()}</Text>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Box>

            <Separator />

            {/* Content Classification */}
            {(content.FormName || content.GenreName) && (
              <Box>
                <Text size="4" weight="bold" mb="2">
                  {t('content.classification')}
                </Text>
                <Flex direction="column" gap="2">
                  {content.FormName && (
                    <Flex justify="between" align="center">
                      <Text size="2" color="gray">{t('content.form')}:</Text>
                      <Text size="2">{content.FormName}</Text>
                    </Flex>
                  )}
                  {content.GenreName && (
                    <Flex justify="between" align="center">
                      <Text size="2" color="gray">{t('content.genre')}:</Text>
                      <Text size="2">{content.GenreName}</Text>
                    </Flex>
                  )}
                </Flex>
              </Box>
            )}

            <Separator />

            {/* Publisher Information */}
            <Box>
              <Text size="4" weight="bold" mb="2">
                {t('content.publisherInformation')}
              </Text>
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.publisher')}:</Text>
                  <Flex align="center" gap="1">
                    <User size="14" />
                    <Text size="2">{content.PublisherId}</Text>
                  </Flex>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.publishedDate')}:</Text>
                  <Flex align="center" gap="1">
                    <Calendar size="14" />
                    <Text size="2">{formatDate(content.PublishedAt)}</Text>
                  </Flex>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.uploadDate')}:</Text>
                  <Text size="2">{formatDate(media.UploadDate)}</Text>
                </Flex>
              </Flex>
            </Box>

            <Separator />

            {/* Analytics */}
            {(content.ViewCount !== undefined || content.DownloadCount !== undefined) && (
              <Box>
                <Text size="4" weight="bold" mb="2">
                  {t('content.analytics')}
                </Text>
                <Flex direction="column" gap="2">
                  {content.ViewCount !== undefined && (
                    <Flex justify="between" align="center">
                      <Text size="2" color="gray">{t('content.views')}:</Text>
                      <Flex align="center" gap="1">
                        <Eye size="14" />
                        <Text size="2">{content.ViewCount}</Text>
                      </Flex>
                    </Flex>
                  )}
                  {content.DownloadCount !== undefined && (
                    <Flex justify="between" align="center">
                      <Text size="2" color="gray">{t('content.downloads')}:</Text>
                      <Flex align="center" gap="1">
                        <Download size="14" />
                        <Text size="2">{content.DownloadCount}</Text>
                      </Flex>
                    </Flex>
                  )}
                </Flex>
              </Box>
            )}

            <Separator />

            {/* Protection Settings */}
            <Box>
              <Text size="4" weight="bold" mb="2">
                {t('content.protectionSettings')}
              </Text>
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.watermark')}:</Text>
                  <Badge color={publishingSettings.shouldApplyWatermark ? 'red' : 'green'}>
                    {publishingSettings.shouldApplyWatermark ? t('content.enabled') : t('content.disabled')}
                  </Badge>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.copyProtection')}:</Text>
                  <Badge color={publishingSettings.shouldDisableCopy ? 'red' : 'green'}>
                    {publishingSettings.shouldDisableCopy ? t('content.enabled') : t('content.disabled')}
                  </Badge>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">{t('content.downloadRestriction')}:</Text>
                  <Badge color={publishingSettings.shouldDisableDownload ? 'red' : 'green'}>
                    {publishingSettings.shouldDisableDownload ? t('content.enabled') : t('content.disabled')}
                  </Badge>
                </Flex>
              </Flex>
            </Box>

            {/* Description */}
            {media.Description && (
              <>
                <Separator />
                <Box>
                  <Text size="4" weight="bold" mb="2">
                    {t('content.description')}
                  </Text>
                  <Text size="2" color="gray">
                    {media.Description}
                  </Text>
                </Box>
              </>
            )}

          </Flex>
        </Box>

        <Flex justify="end" gap="2" mt="4">
          <Button variant="soft" onClick={() => setOpen(false)}>
            {t('content.close')}
          </Button>
        </Flex>
      </DialogContent>
    </Dialog.Root>
  );
} 
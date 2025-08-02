import { useState } from 'react';
import { Dialog, Button, Box, Flex, Text } from '@radix-ui/themes';
import { Download, Share2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/Toast';

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

interface ShareResponse {
  shareUrl: string;
}

interface MediaPreviewProps {
  media: Media;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaPreview({ media, open, onOpenChange }: MediaPreviewProps) {
  const [isSharing, setIsSharing] = useState(false);
  const { showToast } = useToast();

  const handleShare = async () => {
    try {
      setIsSharing(true);
      const response = await fetch(`/api/media/${media.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expiresIn: '7d',
          maxAccesses: 10,
        }),
      });
      if (!response.ok) throw new Error('Failed to create share link');
      const data = await response.json() as ShareResponse;
      await navigator.clipboard.writeText(data.shareUrl);
      showToast({
        title: 'Success',
        content: 'Share link copied',
        type: 'success'
      });
    } catch (error) {
      console.error('Error creating share link:', error);
      showToast({
        title: 'Error',
        content: 'Failed to create share link',
        type: 'error'
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/media/${media.id}/download`);
      if (!response.ok) throw new Error('Failed to download file');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast({
        title: 'Error',
        content: 'Failed to download file',
        type: 'error'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center">
            <Dialog.Title>{media.fileName}</Dialog.Title>
            <Dialog.Close>
              <Button variant="soft">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </Flex>

          <Box className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {media.mediaType === 'image' ? (
              <img
                src={`/api/media/${media.id}/preview`}
                alt={media.fileName}
                className="w-full h-full object-contain"
              />
            ) : media.mediaType === 'video' ? (
              <video
                src={`/api/media/${media.id}/preview`}
                controls
                className="w-full h-full"
              />
            ) : media.mediaType === 'audio' ? (
              <audio
                src={`/api/media/${media.id}/preview`}
                controls
                className="w-full"
              />
            ) : (
              <Flex align="center" justify="center" className="w-full h-full">
                <Text>Preview not available for this file type</Text>
              </Flex>
            )}
          </Box>

          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              {formatFileSize(media.fileSize)} • {formatDistanceToNow(new Date(media.uploadDate))} ago
            </Text>
            {media.description && (
              <Text size="2">{media.description}</Text>
            )}
          </Flex>

          <Flex gap="2" justify="end">
            <Button variant="soft" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="soft" onClick={handleShare} disabled={isSharing}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
} 
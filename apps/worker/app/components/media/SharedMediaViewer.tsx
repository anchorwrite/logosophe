'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Box, Flex, Text, Button, Container, ScrollArea, TextField } from '@radix-ui/themes';
import { decrypt } from '@/lib/encryption';

interface SharedMediaViewerProps {
  token: string;
}

interface MediaResponse {
  id: string;
  fileName: string;
  fileSize: number;
  mediaType: string;
  passwordHash?: string;
  [key: string]: any; // Allow for additional properties
}

export function SharedMediaViewer({ token }: SharedMediaViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/media/share/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Share link not found');
          } else if (response.status === 410) {
            throw new Error('Share link has expired or reached maximum access limit');
          } else {
            throw new Error('Failed to load media');
          }
        }
        const data = await response.json() as MediaResponse;
        console.log('Media data received:', data);
        setMedia(data);
        if (data.passwordHash) {
          console.log('Password hash found:', data.passwordHash);
          try {
            const password = await decrypt(data.passwordHash, token);
            console.log('Password decrypted:', password);
            setDecryptedPassword(password);
          } catch (err) {
            console.error('Error decrypting password:', err);
            setError('Failed to decrypt password');
          }
        } else {
          console.log('No password hash found in response');
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();
  }, [token]);

  const handleDownload = async () => {
    if (!media) return;
    
    try {
      const response = await fetch(`/api/media/share/${token}/download`);
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
      setError('Failed to download file. Please try again.');
    }
  };

  if (error) {
    return (
      <Box className="rounded-lg border border-red-200 bg-red-50 p-4">
        <Flex gap="2" align="start">
          <AlertCircle className="h-4 w-4 text-red-500 mt-1" />
          <Box>
            <Text as="p" weight="bold" color="red">Error</Text>
            <Text as="p" color="red">{error}</Text>
          </Box>
        </Flex>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" className="min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </Flex>
    );
  }

  if (!media) {
    return (
      <Box className="rounded-lg border border-red-200 bg-red-50 p-4">
        <Text color="red">Media not found</Text>
      </Box>
    );
  }

  const renderViewer = () => {
    switch (media.mediaType) {
      case 'image':
        return (
          <img
            src={`/api/media/${media.id}/preview?shareToken=${token}`}
            alt={media.fileName}
            className="max-w-full max-h-[80vh] object-contain"
          />
        );
      case 'video':
        return (
          <video
            src={`/api/media/${media.id}/preview?shareToken=${token}`}
            controls
            className="max-w-full max-h-[80vh]"
          />
        );
      case 'audio':
        return (
          <audio
            src={`/api/media/${media.id}/preview?shareToken=${token}`}
            controls
            className="w-full"
          />
        );
      case 'document':
        return (
          <iframe
            src={`/api/media/${media.id}/preview?shareToken=${token}`}
            className="w-full h-[80vh]"
          />
        );
      default:
        return (
          <Flex justify="center" align="center" py="6">
            <Text color="gray">Preview not available</Text>
          </Flex>
        );
    }
  };

  return (
    <Container size="3">
      <Box className="space-y-6">
        <Flex justify="between" align="center">
          <Box>
            <Text as="p" size="6" weight="bold">{media.fileName}</Text>
            <Text as="p" size="2" color="gray" mt="1">
              {(media.fileSize / 1024 / 1024).toFixed(2)} MB
            </Text>
          </Box>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </Flex>

        {decryptedPassword && (
          <Box className="rounded-lg border bg-card p-4">
            <Text as="p" size="2" weight="bold" mb="2">File Password</Text>
            <Flex gap="2" align="center">
              <TextField.Root>
                <TextField.Input
                  value={decryptedPassword}
                  readOnly
                />
              </TextField.Root>
              <Button
                variant="soft"
                onClick={() => {
                  navigator.clipboard.writeText(decryptedPassword);
                  // You might want to add a toast notification here
                }}
              >
                Copy Password
              </Button>
            </Flex>
          </Box>
        )}

        <ScrollArea>
          <Box className="rounded-lg border bg-card p-4">
            {renderViewer()}
          </Box>
        </ScrollArea>
      </Box>
    </Container>
  );
} 
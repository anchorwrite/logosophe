'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, Button, Dialog, TextField } from '@radix-ui/themes';
import { Search, Download, Eye, Trash2, Share2, Users, Minus, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface ShareLink {
  id: string;
  mediaId: string;
  shareUrl: string;
  expiresAt?: string;
  maxAccesses?: number;
  currentAccesses: number;
  isPasswordProtected: boolean;
  createdAt: string;
  mediaFileName: string;
}

interface MediaShareLinksProps {
  mediaId?: string;
}

export function MediaShareLinks({ mediaId }: MediaShareLinksProps) {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; link: ShareLink | null }>({
    isOpen: false,
    link: null
  });

  useEffect(() => {
    fetchShareLinks();
  }, [mediaId]);

  const fetchShareLinks = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = mediaId 
        ? `/api/media/${mediaId}/shares`
        : '/api/media/shares';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch share links: ${errorText}`);
      }

      const data = await response.json() as { shareLinks: ShareLink[] };
      setShareLinks(data.shareLinks || []);
    } catch (err) {
      console.error('Error fetching share links:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch share links');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (link: ShareLink) => {
    setDeleteDialog({ isOpen: true, link });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.link) return;

    try {
      const response = await fetch(`/api/media/shares/${deleteDialog.link.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete share link');
      }

      setDeleteDialog({ isOpen: false, link: null });
      await fetchShareLinks();

      showToast({
        type: 'success',
        title: 'Success',
        content: t('media.shareLinkDeleted')
      });
    } catch (err) {
      console.error('Error deleting share link:', err);
      showToast({
        type: 'error',
        title: 'Error',
        content: err instanceof Error ? err.message : 'Failed to delete share link'
      });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="gray">{t('media.loadingShareLinks')}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="red" mb="2">{error}</Text>
        <Button onClick={fetchShareLinks}>
          {t('media.tryAgain')}
        </Button>
      </Box>
    );
  }

  if (shareLinks.length === 0) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="gray">{t('media.noShareLinks')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t('media.fileName')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('media.shareUrl')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('media.expiresAt')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('media.accesses')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('media.createdAt')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('media.actions')}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {shareLinks.map((link) => (
            <Table.Row key={link.id}>
              <Table.Cell>
                <Text size="2">{link.mediaFileName}</Text>
              </Table.Cell>
              <Table.Cell>
                <Flex gap="2" align="center">
                  <Text size="2" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {link.shareUrl}
                  </Text>
                  <Button
                    variant="soft"
                    size="1"
                    onClick={() => copyToClipboard(link.shareUrl)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">
                  {link.expiresAt ? formatDate(link.expiresAt) : t('media.neverExpires')}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">
                  {link.currentAccesses}
                  {link.maxAccesses && ` / ${link.maxAccesses}`}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDate(link.createdAt)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Flex gap="2" justify="end">
                  <Button
                    variant="soft"
                    size="1"
                    asChild
                  >
                    <a href={link.shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    variant="soft"
                    size="1"
                    color="red"
                    onClick={() => handleDelete(link)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Flex>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      <Dialog.Root open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ isOpen: open, link: deleteDialog.link })}>
        <Dialog.Content>
          <Dialog.Title>{t('media.deleteShareLink')}</Dialog.Title>
          <Dialog.Description>
            {t('media.deleteShareLinkConfirm')}
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">{t('media.cancel')}</Button>
            </Dialog.Close>
            <Button color="red" onClick={confirmDelete}>
              {t('media.delete')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </Box>
  );
} 
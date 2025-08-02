'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, Button, Dialog } from '@radix-ui/themes';
import { Copy, Trash2, Eye, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface ShareLink {
  Id: string;
  MediaId: string;
  ShareToken: string;
  ExpiresAt: string;
  CreatedAt: string;
  CreatedBy: string;
  TenantId: string;
  MaxAccesses: number;
  AccessCount: number;
  MediaFileName: string;
  MediaType: string;
}

interface MediaShareLinksProps {
  initialLinks: ShareLink[];
}

export function MediaShareLinks({ initialLinks }: MediaShareLinksProps) {
  const [links, setLinks] = useState<ShareLink[]>(initialLinks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<ShareLink | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const fetchLinks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/media/shares');
      if (!response.ok) {
        throw new Error('Failed to fetch shared links');
      }
      const data = await response.json() as ShareLink[];
      setLinks(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching shared links:', err);
      if (links.length === 0) {
        setError('Failed to load shared links');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLinks();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLinks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleDelete = (link: ShareLink) => {
    setSelectedLink(link);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLink) return;

    try {
      const response = await fetch(`/api/media/shares/${selectedLink.Id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete shared link');
      }

      setLinks(links.filter(link => link.Id !== selectedLink.Id));
      setIsDeleteDialogOpen(false);
      setSelectedLink(null);
    } catch (err) {
      console.error('Error deleting shared link:', err);
      alert('Failed to delete shared link');
    }
  };

  const copyShareLink = (link: ShareLink) => {
    const shareUrl = `${window.location.origin}/share/${link.ShareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopyNotification('Link copied to clipboard!');
    setTimeout(() => setCopyNotification(null), 2000);
  };

  if (isLoading) {
    return <Text align="center" mt="4">Loading shared links...</Text>;
  }

  if (error) {
    return <Text color="red" align="center" mt="4">{error}</Text>;
  }

  return (
    <Box className="space-y-4 min-h-0 overflow-auto">
      {copyNotification && (
        <Text color="green" align="center" className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded shadow-lg">
          {copyNotification}
        </Text>
      )}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>File Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Uses</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {links.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text align="center">No shared links found</Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            links.map((link) => (
              <Table.Row key={link.Id}>
                <Table.Cell>{link.MediaFileName}</Table.Cell>
                <Table.Cell>
                  <Text className="capitalize">{link.MediaType}</Text>
                </Table.Cell>
                <Table.Cell>
                  {(() => {
                    const dateStr = link.CreatedAt.endsWith('Z') ? link.CreatedAt : `${link.CreatedAt}Z`;
                    const date = parseISO(dateStr);
                    return format(toZonedTime(date, userTimezone), 'MMM d, yyyy h:mm a');
                  })()}
                </Table.Cell>
                <Table.Cell>
                  {link.ExpiresAt ? format(toZonedTime(parseISO(link.ExpiresAt), userTimezone), 'MMM d, yyyy h:mm a') : 'Never'}
                </Table.Cell>
                <Table.Cell>
                  {link.AccessCount} // {link.MaxAccesses || '∞'}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" justify="end">
                    <Button
                      variant="soft"
                      onClick={() => window.open(`/api/media/${link.MediaId}/preview`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="soft"
                      onClick={() => window.open(`/api/media/${link.MediaId}/download`, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="soft"
                      onClick={() => copyShareLink(link)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="soft"
                      color="red"
                      onClick={() => handleDelete(link)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <Dialog.Content style={{ maxHeight: '90vh', overflow: 'auto' }}>
          <Dialog.Title>Delete Shared Link</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete this shared link? This action cannot be undone.
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={confirmDelete}>Delete</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 
import { Metadata } from 'next';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { handleAccessControl } from '@/lib/access-control';
import { Box, Button, Container, Heading, Text } from '@radix-ui/themes';

export const metadata: Metadata = {
  title: 'Media Library | Logosophe',
  description: 'Manage your media files',
};


export default async function MediaLibraryPage() {
  // Check access - only allow admin, tenant, editor, and author roles
  await handleAccessControl({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'editor', 'author']
  });

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Heading size="6">Media Library</Heading>
            <Text as="p" size="2" color="gray">
              Manage and organize your media files
            </Text>
          </Box>
          <Link href="/dashboard/media/upload">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Upload Media
            </Button>
          </Link>
        </Box>

        <MediaLibrary />
      </Box>
    </Container>
  );
} 
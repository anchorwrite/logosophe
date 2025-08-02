import { Metadata } from 'next';
import { MediaUpload } from './MediaUpload';
import { handleAccessControl } from '@/lib/access-control';
import { Container, Box, Heading, Text } from '@radix-ui/themes';

export const metadata: Metadata = {
  title: 'Upload Media | Logosophe',
  description: 'Upload media files to your library',
};


export default async function MediaUploadPage() {
  // Check access - only allow admin, tenant, editor, and author roles
  await handleAccessControl({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'editor', 'author']
  });

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6" style={{ textAlign: 'center' }}>
          <Heading size="6">Upload Media</Heading>
          <Text as="p" size="2" color="gray" mt="2">
            Upload media files to your library
          </Text>
        </Box>
        <MediaUpload />
      </Box>
    </Container>
  );
} 
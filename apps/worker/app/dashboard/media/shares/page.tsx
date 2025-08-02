import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { MediaShareLinks } from '@/components/media/MediaShareLinks';
import { Text, Box } from '@radix-ui/themes';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

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

async function getShareLinks(): Promise<ShareLink[]> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;

  // Check authentication
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'editor', 'author']
  });

  if (!access.hasAccess) {
    throw new Error('Unauthorized');
  }

  // Check if user is an admin
  const isAdmin = await isSystemAdmin(access.email!, db);

  // Get all share links for the user's tenants
  const shareLinks = await db.prepare(isAdmin ? `
    SELECT 
      msl.Id,
      msl.MediaId,
      msl.ShareToken,
      msl.CreatedAt,
      msl.ExpiresAt,
      msl.MaxAccesses,
      msl.AccessCount,
      m.FileName as MediaFileName,
      m.ContentType,
      m.MediaType,
      m.FileSize,
      msl.TenantId,
      t.Name as TenantName
    FROM MediaShareLinks msl
    INNER JOIN MediaFiles m ON msl.MediaId = m.Id
    INNER JOIN Tenants t ON msl.TenantId = t.Id
    ORDER BY msl.CreatedAt DESC
  ` : `
    SELECT 
      msl.Id,
      msl.MediaId,
      msl.ShareToken,
      msl.CreatedAt,
      msl.ExpiresAt,
      msl.MaxAccesses,
      msl.AccessCount,
      m.FileName as MediaFileName,
      m.ContentType,
      m.MediaType,
      m.FileSize,
      msl.TenantId,
      t.Name as TenantName
    FROM MediaShareLinks msl
    INNER JOIN MediaFiles m ON msl.MediaId = m.Id
    INNER JOIN Tenants t ON msl.TenantId = t.Id
    INNER JOIN TenantUsers tu ON msl.TenantId = tu.TenantId
    WHERE tu.Email = ?
    ORDER BY msl.CreatedAt DESC
  `)
    .bind(...(isAdmin ? [] : [access.email]))
    .all();

  // Type assertion with validation
  const results = shareLinks.results as unknown as ShareLink[];
  
  // Validate the shape of the data
  if (!Array.isArray(results)) {
    throw new Error('Expected array of share links');
  }

  // Validate each item has the required properties
  results.forEach((item, index) => {
    if (!item.Id || !item.MediaId || !item.ShareToken || !item.CreatedAt) {
      throw new Error(`Invalid share link data at index ${index}`);
    }
  });

  return results;
}

export default async function SharedLinksPage() {
  const session = await auth();
  if (!session) {
    redirect('/signin');
  }

  const links = await getShareLinks();

  return (
    <div className="container mx-auto py-8">
      <Box mb="6">
        <Text size="6" weight="bold" align="center">Shared Media Links</Text>
      </Box>
      <MediaShareLinks initialLinks={links} />
    </div>
  );
} 
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { NormalizedLogging } from './normalized-logging';

export type MediaType = 'audio' | 'video' | 'image' | 'document';
export type MediaAction = 'view' | 'download';

interface MediaAccessCheck {
  hasAccess: boolean;
  accessLevel: 'full' | 'write' | 'read' | 'none';
}

interface MediaFile {
  FileName: string;
  TenantId: string;
}

export async function checkMediaAccess(mediaId: number, action: MediaAction): Promise<MediaAccessCheck> {
  const session = await auth();
  if (!session?.user?.email) {
    return { hasAccess: false, accessLevel: 'none' };
  }

  const context = await getCloudflareContext({async: true});
  const db = context.env.DB;

  // First check if the media exists and get its access group
  const media = await db.prepare(`
    SELECT mc.*, mag.Name as AccessGroupName
    FROM MediaCatalog mc
    JOIN MediaAccessGroups mag ON mc.AccessGroupId = mag.Id
    WHERE mc.Id = ?
  `).bind(mediaId).first();

  if (!media) {
    return { hasAccess: false, accessLevel: 'none' };
  }

  // Check user's role and permissions
  const userRole = await db.prepare(`
    SELECT r.Name as RoleName
    FROM Roles r
    JOIN UserRoles ur ON r.Id = ur.RoleId
    WHERE ur.UserEmail = ?
  `).bind(session.user.email).first();

  if (!userRole) {
    return { hasAccess: false, accessLevel: 'none' };
  }

  // Check permissions based on role
  const permission = await db.prepare(`
    SELECT p.Name
    FROM Permissions p
    JOIN RolePermissions rp ON p.Id = rp.PermissionId
    JOIN Roles r ON r.Id = rp.RoleId
    WHERE r.Name = ? AND p.Resource = 'media'
  `).bind(userRole.RoleName).all();

  const permissions = permission.results.map((p: any) => p.Name);

  // Determine access level based on permissions
  let accessLevel: 'full' | 'write' | 'read' | 'none' = 'none';
  if (permissions.includes('media.delete')) {
    accessLevel = 'full';
  } else if (permissions.includes('media.write')) {
    accessLevel = 'write';
  } else if (permissions.includes('media.read')) {
    accessLevel = 'read';
  }

  // Check if action is allowed based on access level
  const hasAccess = (
    (action === 'view' && accessLevel !== 'none') ||
    (action === 'download' && (accessLevel === 'full' || accessLevel === 'write' || permissions.includes('media.download')))
  );

  return { hasAccess, accessLevel };
}

export async function logMediaAccess(mediaId: number, action: MediaAction, request?: Request) {
  const session = await auth();
  if (!session?.user?.email) return;

  const context = await getCloudflareContext({async: true});
  const db = context.env.DB;

  // Get media file details for logging
  const media = await db.prepare(`
    SELECT FileName, TenantId
    FROM MediaCatalog
    WHERE Id = ?
  `).bind(mediaId).first<MediaFile>();

  if (!media) return;

  const normalizedLogging = new NormalizedLogging(db);
  await normalizedLogging.logMediaOperations({
    userEmail: session.user.email,
    tenantId: media.TenantId,
    activityType: `${action}_file`,
    accessType: action === 'view' ? 'read' : 'download',
    targetId: mediaId.toString(),
    targetName: media.FileName,
    ipAddress: request?.headers.get('x-forwarded-for')?.toString() || request?.headers.get('x-real-ip')?.toString() || undefined,
    userAgent: request?.headers.get('user-agent')?.toString() || undefined
  });
}

export async function getMediaAccessGroups() {
  const context = await getCloudflareContext({async: true});
  const db = context.env.DB;

  return await db.prepare(`
    SELECT Id, Name, Description
    FROM MediaAccessGroups
    ORDER BY Name
  `).all();
}

export async function getMediaCatalog(accessGroupId?: number) {
  const context = await getCloudflareContext({async: true});
  const db = context.env.DB;

  const query = accessGroupId
    ? `SELECT * FROM MediaCatalog WHERE AccessGroupId = ? ORDER BY Name`
    : `SELECT * FROM MediaCatalog ORDER BY Name`;

  return await db.prepare(query)
    .bind(accessGroupId || [])
    .all();
} 
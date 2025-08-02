import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get tenant context from query parameters
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    // Verify the media file belongs to the user
    const mediaFile = await db.prepare(`
      SELECT Id, FileName, R2Key FROM MediaFiles 
      WHERE Id = ? AND UploadedBy = ? AND IsDeleted = 0
    `).bind(id, access.email).first();

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    // Check if user has access to the specified tenant
    if (tenantId) {
      const tenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers
        WHERE Email = ? AND TenantId = ?
      `).bind(access.email, tenantId).first();

      if (!tenantAccess) {
        return new Response('Unauthorized for this tenant', { status: 401 });
      }
    }

    // Check if file exists in other tenants
    const otherTenants = await db.prepare(`
      SELECT DISTINCT ma.TenantId, t.Name as TenantName
      FROM MediaAccess ma
      JOIN Tenants t ON ma.TenantId = t.Id
      WHERE ma.MediaId = ? AND ma.TenantId != ?
    `).bind(id, tenantId || 'default').all();

    const systemLogs = new SystemLogs(db);

    if (otherTenants.results.length > 0) {
      // File exists in other tenants - only remove from current tenant
      await db.prepare(`
        DELETE FROM MediaAccess
        WHERE MediaId = ? AND TenantId = ?
      `).bind(id, tenantId || 'default').run();

      // Log the tenant removal
      await systemLogs.logMediaAccess({
        userEmail: access.email,
        tenantId: tenantId || 'default',
        accessType: 'remove_tenant',
        targetId: id,
        targetName: mediaFile.FileName as string,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          removedFromTenant: true,
          otherTenants: otherTenants.results.map((t: any) => t.TenantId),
          harborDelete: true
        }
      });

      return Response.json({ 
        success: true, 
        message: 'File removed from tenant',
        otherTenants: otherTenants.results.length
      });
    } else {
      // No other tenants - soft delete the entire file
      await db.prepare(`
        UPDATE MediaFiles 
        SET IsDeleted = 1, 
            DeletedAt = datetime('now'), 
            DeletedBy = ?
        WHERE Id = ?
      `).bind(access.email, id).run();

      // Delete associated share links
      await db.prepare(`
        DELETE FROM MediaShareLinks WHERE MediaId = ?
      `).bind(id).run();

      // Log the soft deletion
      await systemLogs.logMediaAccess({
        userEmail: access.email,
        accessType: 'soft_delete',
        targetId: id,
        targetName: mediaFile.FileName as string,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          softDeleted: true,
          r2Key: mediaFile.R2Key as string,
          canBeRestored: true,
          harborDelete: true,
          lastTenant: true
        }
      });

      return Response.json({ 
        success: true, 
        message: 'File deleted completely'
      });
    }
  } catch (error) {
    console.error('Error deleting media file:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
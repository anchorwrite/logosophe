import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: fileId } = await params;

    // Check if user is a system admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    
    // Get user's tenants if not global admin
    let userTenants: Array<{ TenantId: string }> = [];
    if (!isGlobalAdmin) {
      const tenantResult = await db.prepare(`
        SELECT TenantId FROM TenantUsers 
        WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).all();
      userTenants = (tenantResult.results || []) as Array<{ TenantId: string }>;
      
      if (userTenants.length === 0) {
        return new Response('No tenant admin access found', { status: 403 });
      }
    }

    // Get file details and verify access
    const fileQuery = isGlobalAdmin ? `
      SELECT m.*, t.Name as tenantName
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.Id = ? AND m.IsDeleted = 1
    ` : `
      SELECT m.*, t.Name as tenantName
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.Id = ? AND m.IsDeleted = 1 AND ma.TenantId IN (${userTenants.map(() => '?').join(',')})
    `;

    const fileParams = isGlobalAdmin ? [fileId] : [fileId, ...userTenants.map(t => t.TenantId)];
    const file = await db.prepare(fileQuery).bind(...fileParams).first();

    if (!file) {
      return new Response('File not found or access denied', { status: 404 });
    }

    // Get the request body for optional reason
    let reason = '';
    try {
      const body = await request.json() as { reason?: string };
      reason = body.reason || '';
    } catch {
      // No body provided, use empty reason
    }

    // Log the permanent deletion
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'MEDIA_PERMANENT_DELETE',
      timestamp: new Date().toISOString(),
      userEmail: access.email,
      tenantId: file.TenantId as string,
      accessType: 'permanent_delete',
      targetId: fileId,
      targetName: file.FileName as string,
      metadata: {
        fileSize: file.FileSize as number,
        contentType: file.ContentType as string,
        r2Key: file.R2Key as string,
        reason: reason || 'Admin permanent deletion',
        wasSoftDeleted: true,
        softDeletedAt: file.DeletedAt as string,
        softDeletedBy: file.DeletedBy as string,
        tenantName: file.tenantName as string
      }
    });

    // Delete from R2 storage
    await env.MEDIA_BUCKET.delete(file.R2Key as string);

    // Permanently delete from database
    await db.prepare(`
      DELETE FROM MediaFiles WHERE Id = ?
    `).bind(fileId).run();

    return Response.json({
      success: true,
      message: 'File permanently deleted',
      deletedFile: {
        id: fileId,
        fileName: file.FileName as string,
        fileSize: file.FileSize as number,
        r2Key: file.R2Key as string
      }
    });

  } catch (error) {
    console.error('Error permanently deleting file:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
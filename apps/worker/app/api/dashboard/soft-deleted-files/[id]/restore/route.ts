import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


export async function POST(
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

    // Restore the file by setting IsDeleted to 0
    await db.prepare(`
      UPDATE MediaFiles 
      SET IsDeleted = 0, 
          DeletedAt = NULL, 
          DeletedBy = NULL
      WHERE Id = ?
    `).bind(fileId).run();

    // Log the restoration
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logMediaOperations({
      userEmail: access.email,
      tenantId: file.TenantId as string,
      activityType: 'restore_file',
      accessType: 'write',
      targetId: fileId.toString(),
      targetName: file.FileName as string,
      ipAddress,
      userAgent,
      metadata: {
        fileSize: file.FileSize as number,
        contentType: file.ContentType as string,
        r2Key: file.R2Key as string,
        wasSoftDeleted: true,
        softDeletedAt: file.DeletedAt as string,
        softDeletedBy: file.DeletedBy as string,
        tenantName: file.tenantName as string,
        restoredBy: access.email
      }
    });

    return Response.json({
      success: true,
      message: 'File restored successfully',
      restoredFile: {
        id: fileId,
        fileName: file.FileName as string
      }
    });

  } catch (error) {
    console.error('Error restoring file:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
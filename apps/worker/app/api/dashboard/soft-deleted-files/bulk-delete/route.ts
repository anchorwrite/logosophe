import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


interface BulkDeleteRequest {
  fileIds: number[];
  reason?: string;
}

interface BulkDeleteResponse {
  success: boolean;
  deletedCount: number;
  totalStorageFreed: number;
  errors: Array<{
    fileId: number;
    error: string;
  }>;
}

export async function POST(request: NextRequest) {
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

    const body: BulkDeleteRequest = await request.json();
    const { fileIds, reason = 'Bulk permanent deletion' } = body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response('No file IDs provided', { status: 400 });
    }

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

    // Get files to delete with access verification
    const filesQuery = isGlobalAdmin ? `
      SELECT m.*, t.Name as tenantName
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.Id IN (${fileIds.map(() => '?').join(',')}) AND m.IsDeleted = 1
    ` : `
      SELECT m.*, t.Name as tenantName
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.Id IN (${fileIds.map(() => '?').join(',')}) 
        AND m.IsDeleted = 1 
        AND ma.TenantId IN (${userTenants.map(() => '?').join(',')})
    `;

    const filesParams = isGlobalAdmin 
      ? fileIds 
      : [...fileIds, ...userTenants.map(t => t.TenantId)];

    const filesResult = await db.prepare(filesQuery).bind(...filesParams).all();
    const files = filesResult.results || [];

    if (files.length === 0) {
      return new Response('No accessible files found for deletion', { status: 404 });
    }

    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    const errors: Array<{ fileId: number; error: string }> = [];
    let deletedCount = 0;
    let totalStorageFreed = 0;

    // Process each file
    for (const file of files) {
      try {
        // Log the permanent deletion
        await normalizedLogging.logMediaOperations({
          userEmail: access.email,
          tenantId: file.TenantId as string,
          activityType: 'bulk_permanent_delete_file',
          accessType: 'delete',
          targetId: (file.Id as number).toString(),
          targetName: file.FileName as string,
          ipAddress,
          userAgent,
          metadata: {
            fileSize: file.FileSize as number,
            contentType: file.ContentType as string,
            r2Key: file.R2Key as string,
            reason: reason,
            wasSoftDeleted: true,
            softDeletedAt: file.DeletedAt as string,
            softDeletedBy: file.DeletedBy as string,
            tenantName: file.tenantName as string,
            bulkOperation: true
          }
        });

        // Delete from R2 storage
        await env.MEDIA_BUCKET.delete(file.R2Key as string);

        // Permanently delete from database
        await db.prepare(`
          DELETE FROM MediaFiles WHERE Id = ?
        `).bind(file.Id as number).run();

        deletedCount++;
        totalStorageFreed += file.FileSize as number;

      } catch (error) {
        console.error(`Error deleting file ${file.Id}:`, error);
        errors.push({
          fileId: file.Id as number,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const response: BulkDeleteResponse = {
      success: deletedCount > 0,
      deletedCount,
      totalStorageFreed,
      errors
    };

    return Response.json(response);

  } catch (error) {
    console.error('Error in bulk delete operation:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
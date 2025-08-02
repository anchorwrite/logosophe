import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

interface SoftDeletedFile {
  id: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  mediaType: string;
  deletedAt: string;
  deletedBy: string;
  originalUploadDate: string;
  r2Key: string;
  tenantId?: string;
  tenantName?: string;
  workflowCount: number;
}

interface SoftDeletedFilesStats {
  totalFiles: number;
  totalStorageBytes: number;
  storageByType: {
    audio: { count: number; bytes: number };
    video: { count: number; bytes: number };
    image: { count: number; bytes: number };
    document: { count: number; bytes: number };
  };
  oldestDeleted: string;
  newestDeleted: string;
  deletedByUser: Record<string, number>;
  tenantBreakdown?: Array<{
    tenantId: string;
    tenantName: string;
    fileCount: number;
    storageBytes: number;
  }>;
}

export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

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

    // Build base query for soft-deleted files
    const baseWhereClause = isGlobalAdmin 
      ? 'WHERE m.IsDeleted = 1'
      : `WHERE m.IsDeleted = 1 AND m.TenantId IN (${userTenants.map(() => '?').join(',')})`;

    // Get statistics
    const statsQuery = isGlobalAdmin ? `
      SELECT 
        COUNT(*) as totalFiles,
        SUM(FileSize) as totalStorageBytes,
        MediaType,
        MIN(DeletedAt) as oldestDeleted,
        MAX(DeletedAt) as newestDeleted
      FROM MediaFiles m
      WHERE IsDeleted = 1
      GROUP BY MediaType
    ` : `
      SELECT 
        COUNT(*) as totalFiles,
        SUM(FileSize) as totalStorageBytes,
        MediaType,
        MIN(DeletedAt) as oldestDeleted,
        MAX(DeletedAt) as newestDeleted
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE IsDeleted = 1 AND ma.TenantId IN (${userTenants.map(() => '?').join(',')})
      GROUP BY MediaType
    `;

    const statsParams = isGlobalAdmin ? [] : userTenants.map(t => t.TenantId);
    const statsResult = await db.prepare(statsQuery).bind(...statsParams).all();

    // Get deleted by user statistics
    const deletedByQuery = isGlobalAdmin ? `
      SELECT DeletedBy, COUNT(*) as count
      FROM MediaFiles
      WHERE IsDeleted = 1
      GROUP BY DeletedBy
      ORDER BY count DESC
    ` : `
      SELECT DeletedBy, COUNT(*) as count
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE IsDeleted = 1 AND ma.TenantId IN (${userTenants.map(() => '?').join(',')})
      GROUP BY DeletedBy
      ORDER BY count DESC
    `;

    const deletedByResult = await db.prepare(deletedByQuery).bind(...statsParams).all();

    // Get tenant breakdown for global admins
    let tenantBreakdown: Array<{ tenantId: string; tenantName: string; fileCount: number; storageBytes: number }> = [];
    if (isGlobalAdmin) {
      const tenantBreakdownQuery = `
        SELECT 
          ma.TenantId,
          t.Name as tenantName,
          COUNT(*) as fileCount,
          SUM(m.FileSize) as storageBytes
        FROM MediaFiles m
        INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
        LEFT JOIN Tenants t ON ma.TenantId = t.Id
        WHERE m.IsDeleted = 1
        GROUP BY ma.TenantId, t.Name
        ORDER BY storageBytes DESC
      `;
      const tenantBreakdownResult = await db.prepare(tenantBreakdownQuery).all();
      tenantBreakdown = (tenantBreakdownResult.results || []) as Array<{
        tenantId: string;
        tenantName: string;
        fileCount: number;
        storageBytes: number;
      }>;
    }

    // Calculate stats
    const stats: SoftDeletedFilesStats = {
      totalFiles: 0,
      totalStorageBytes: 0,
      storageByType: {
        audio: { count: 0, bytes: 0 },
        video: { count: 0, bytes: 0 },
        image: { count: 0, bytes: 0 },
        document: { count: 0, bytes: 0 }
      },
      oldestDeleted: '',
      newestDeleted: '',
      deletedByUser: {},
      tenantBreakdown: isGlobalAdmin ? tenantBreakdown : undefined
    };

    // Process stats results
    statsResult.results?.forEach((row: any) => {
      const mediaType = row.MediaType as keyof typeof stats.storageByType;
      if (mediaType && stats.storageByType[mediaType]) {
        stats.storageByType[mediaType].count = row.totalFiles;
        stats.storageByType[mediaType].bytes = row.totalStorageBytes || 0;
      }
      stats.totalFiles += row.totalFiles;
      stats.totalStorageBytes += row.totalStorageBytes || 0;
      
      if (!stats.oldestDeleted || row.oldestDeleted < stats.oldestDeleted) {
        stats.oldestDeleted = row.oldestDeleted;
      }
      if (!stats.newestDeleted || row.newestDeleted > stats.newestDeleted) {
        stats.newestDeleted = row.newestDeleted;
      }
    });

    // Process deleted by user stats
    deletedByResult.results?.forEach((row: any) => {
      stats.deletedByUser[row.DeletedBy] = row.count;
    });

    // Get paginated file list
    const filesQuery = isGlobalAdmin ? `
      SELECT 
        m.*,
        t.Name as tenantName,
        (SELECT COUNT(*) FROM WorkflowMessages wm WHERE wm.MediaFileId = m.Id) as workflowCount
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.IsDeleted = 1
      ORDER BY m.DeletedAt DESC
      LIMIT ? OFFSET ?
    ` : `
      SELECT 
        m.*,
        t.Name as tenantName,
        (SELECT COUNT(*) FROM WorkflowMessages wm WHERE wm.MediaFileId = m.Id) as workflowCount
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.IsDeleted = 1 AND ma.TenantId IN (${userTenants.map(() => '?').join(',')})
      ORDER BY m.DeletedAt DESC
      LIMIT ? OFFSET ?
    `;

    const filesParams = isGlobalAdmin 
      ? [pageSize, offset]
      : [...userTenants.map(t => t.TenantId), pageSize, offset];

    const filesResult = await db.prepare(filesQuery).bind(...filesParams).all();

    const files: SoftDeletedFile[] = filesResult.results?.map((file: any) => ({
      id: file.Id as number,
      fileName: file.FileName as string,
      fileSize: file.FileSize as number,
      contentType: file.ContentType as string,
      mediaType: file.MediaType as string,
      deletedAt: file.DeletedAt as string,
      deletedBy: file.DeletedBy as string,
      originalUploadDate: file.UploadDate as string,
      r2Key: file.R2Key as string,
      tenantId: file.TenantId as string || undefined,
      tenantName: file.tenantName as string || undefined,
      workflowCount: file.workflowCount as number
    })) || [];

    return Response.json({
      stats,
      files,
      pagination: {
        total: stats.totalFiles,
        page,
        pageSize,
        totalPages: Math.ceil(stats.totalFiles / pageSize)
      }
    });

  } catch (error) {
    console.error('Error fetching soft-deleted files:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
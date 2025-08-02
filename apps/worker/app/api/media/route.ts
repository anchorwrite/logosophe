import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


interface MediaFile {
  Id: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: number;
  Duration?: number;
  Width?: number;
  Height?: number;
  TenantId: string;
  R2Key: string;
  Language?: string;
  AccessTenantId?: string;  // For regular user view
  TenantName?: string;      // For regular user view
  AccessTenantIds?: string; // For admin view
  TenantNames?: string;     // For admin view
  AllTenants?: Array<{ id: string; name: string }>; // For admin view
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
    const sortBy = searchParams.get('sortBy') || 'newest';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const uploadedBy = searchParams.get('uploadedBy') || '';
    const offset = (page - 1) * pageSize;

    if (!access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get user's tenants if not admin
    let tenantIds: string[] = [];
    if (!isAdmin) {
      const userTenants = await db.prepare(`
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      `).bind(access.email).all();

      if (!userTenants.results || userTenants.results.length === 0) {
        return new Response('No tenant access found', { status: 403 });
      }

      tenantIds = userTenants.results.map((t: any) => t.TenantId);
    }

    // First get total count
    let countSql = isAdmin ? `
      SELECT COUNT(DISTINCT m.Id) as total
      FROM MediaFiles m
      WHERE m.IsDeleted = 0
    ` : `
      SELECT COUNT(DISTINCT m.Id) as total
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE ma.TenantId IN (${tenantIds.map(() => '?').join(',')})
        AND m.IsDeleted = 0
    `;
    const countParams: any[] = isAdmin ? [] : [...tenantIds];

    if (search) {
      countSql += ' AND m.FileName LIKE ?';
      countParams.push(`%${search}%`);
    }
    if (type !== 'all') {
      countSql += ' AND m.MediaType = ?';
      countParams.push(type);
    }
    if (uploadedBy) {
      countSql += ' AND m.UploadedBy = ?';
      countParams.push(uploadedBy);
    }

    const countResult = await db.prepare(countSql).bind(...countParams).first();
    const total = Number(countResult?.total ?? 0);

    // Then get paginated results
    let sql = isAdmin ? `
      WITH FileTenants AS (
        SELECT 
          m.Id,
          GROUP_CONCAT(DISTINCT ma.TenantId) as AccessTenantIds,
          GROUP_CONCAT(DISTINCT t.Name) as TenantNames
        FROM MediaFiles m
        LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
        LEFT JOIN Tenants t ON ma.TenantId = t.Id
        WHERE m.IsDeleted = 0
        GROUP BY m.Id
      )
      SELECT 
        m.*,
        COALESCE(m.Language, 'en') as Language,
        ft.AccessTenantIds,
        ft.TenantNames
      FROM MediaFiles m
      LEFT JOIN FileTenants ft ON m.Id = ft.Id
      WHERE m.IsDeleted = 0
    ` : `
      SELECT DISTINCT m.*, COALESCE(m.Language, 'en') as Language, ma.TenantId as AccessTenantId, t.Name as TenantName
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      INNER JOIN Tenants t ON ma.TenantId = t.Id
      WHERE ma.TenantId IN (${tenantIds.map(() => '?').join(',')})
        AND m.IsDeleted = 0
    `;

    // Build params array
    const params: any[] = isAdmin ? [] : [...tenantIds];

    if (search) {
      sql += ' AND m.FileName LIKE ?';
      params.push(`%${search}%`);
    }
    if (type !== 'all') {
      sql += ' AND m.MediaType = ?';
      params.push(type);
    }
    if (uploadedBy) {
      sql += ' AND m.UploadedBy = ?';
      params.push(uploadedBy);
    }

    switch (sortBy) {
      case 'oldest':
        sql += ' ORDER BY m.UploadDate ASC';
        break;
      case 'name':
        sql += ' ORDER BY m.FileName ASC';
        break;
      case 'size':
        sql += ' ORDER BY m.FileSize DESC';
        break;
      default:
        sql += ' ORDER BY m.UploadDate DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const stmt = db.prepare(sql).bind(...params);
    const result = await stmt.all<MediaFile>();
    
    // Transform the results to match the expected interface
    const transformedResults = result.results.map(file => {
      if (isAdmin) {
        // For admins, split the concatenated tenant IDs and names
        const tenantIds = file.AccessTenantIds ? file.AccessTenantIds.split(',') : [];
        const tenantNames = file.TenantNames ? file.TenantNames.split(',') : [];
        // Use the first tenant as the primary one for display
        return {
          ...file,
          Id: file.Id.toString(),
          UploadDate: file.UploadDate || new Date().toISOString(),
          TenantId: tenantIds[0] || null,
          TenantName: tenantNames[0] || null,
          AllTenants: tenantIds.map((id: string, index: number) => ({
            id,
            name: tenantNames[index] || id
          }))
        };
      } else {
        // For regular users, keep the existing transformation
        return {
          ...file,
          Id: file.Id.toString(),
          UploadDate: file.UploadDate || new Date().toISOString(),
          TenantId: file.AccessTenantId,
          TenantName: file.TenantName
        };
      }
    });
    
    return Response.json({
      files: transformedResults,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return new Response('No file provided', { status: 400 });
    }

    if (file.size === 0) {
      return new Response('File is empty', { status: 400 });
    }

    const contentType = file.type;
    const fileSize = file.size;
    let mediaType = 'document';
    if (contentType.startsWith('image/')) {
      mediaType = 'image';
    } else if (contentType.startsWith('video/')) {
      mediaType = 'video';
    } else if (contentType.startsWith('audio/')) {
      mediaType = 'audio';
    }

    const tenants = formData.get('tenants');
    if (!tenants || typeof tenants !== 'string') {
      return new Response('No tenants selected', { status: 400 });
    }

    let selectedTenants: string[];
    try {
      selectedTenants = JSON.parse(tenants);
    } catch (e) {
      return new Response('Invalid tenants data format', { status: 400 });
    }

    if (!Array.isArray(selectedTenants) || selectedTenants.length === 0) {
      return new Response('No tenants selected', { status: 400 });
    }

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // For non-admin users, verify they have access to all selected tenants
    if (!isAdmin) {
      const tenantCheck = await db.prepare(`
        SELECT TenantId FROM TenantUsers 
        WHERE Email = ? AND TenantId IN (${selectedTenants.map(() => '?').join(',')})
      `).bind(access.email, ...selectedTenants).all();

      if (!tenantCheck.results || tenantCheck.results.length !== selectedTenants.length) {
        return new Response('Unauthorized access to one or more tenants', { status: 403 });
      }
    }

    // Generate a unique R2 key
    const timestamp = Date.now();
    const r2Key = `media/${timestamp}-${file.name}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    await env.MEDIA_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Insert into MediaFiles
    const result = await db.prepare(`
      INSERT INTO MediaFiles (
        FileName, FileSize, ContentType, MediaType, R2Key, UploadedBy
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      file.name,
      fileSize,
      contentType,
      mediaType,
      r2Key,
      access.email
    ).run();

    if (!result.meta.last_row_id) {
      throw new Error('Failed to insert media file');
    }

    const mediaId = result.meta.last_row_id;

    // Create MediaAccess records for all selected tenants
    const accessResults = await Promise.all(
      selectedTenants.map(tenantId =>
        db.prepare(`
          INSERT INTO MediaAccess (
            MediaId, TenantId, RoleId, AccessType, GrantedBy
          ) VALUES (?, ?, ?, 'view', ?)
        `).bind(
          mediaId, 
          tenantId, 
          isAdmin ? 'admin' : 'tenant', // Use admin role for admin users, tenant role for others
          access.email
        ).run()
      )
    );

    // Log the upload using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: isAdmin ? 'system_admin' : access.email,
      tenantId: selectedTenants[0],
      accessType: 'upload',
      targetId: mediaId.toString(),
      targetName: file.name,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return Response.json({ 
      ids: [mediaId],
      fileName: file.name,
      fileSize,
      contentType,
      r2Key,
      uploadedBy: access.email
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get the media ID from the URL
    const url = new URL(request.url);
    const mediaId = url.pathname.split('/').pop() as string;
    
    if (!mediaId) {
      return new Response('Media ID is required', { status: 400 });
    }

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // First, get the media file details
    const mediaFile = await db.prepare(`
      SELECT m.*
      FROM MediaFiles m
      WHERE m.Id = ?
    `).bind(mediaId).first<MediaFile>();

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    // For non-admin users, verify they have access to this file
    let userAccess: { TenantId: string } | null = null;
    if (!isAdmin) {
      const result = await db.prepare(`
        SELECT ma.TenantId
        FROM MediaAccess ma
        INNER JOIN TenantUsers tu ON ma.TenantId = tu.TenantId
        WHERE ma.MediaId = ? AND tu.Email = ?
      `).bind(mediaId, access.email).first();
      
      userAccess = result as { TenantId: string } | null;

      if (!userAccess) {
        return new Response('No access to this file', { status: 403 });
      }
    }

    // Delete all MediaAccess records for this file
    const deleteResult = await db.prepare(`
      DELETE FROM MediaAccess 
      WHERE MediaId = ?
    `).bind(mediaId).run();

    // Delete from MediaFiles
    const mediaDeleteResult = await db.prepare(`
      DELETE FROM MediaFiles 
      WHERE Id = ?
    `).bind(mediaId).run();

    // Delete from R2
    try {
      await env.MEDIA_BUCKET.delete(mediaFile.R2Key);
    } catch (error) {
      console.error('Error deleting from R2:', error);
      // Continue even if R2 delete fails
    }

    // Log the deletion using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: isAdmin ? 'system_admin' : access.email,
      tenantId: userAccess?.TenantId,
      accessType: 'delete',
      targetId: mediaId,
      targetName: mediaFile.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        fileDeleted: true
      }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting media:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
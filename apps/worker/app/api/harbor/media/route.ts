import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext, createNormalizedMetadata } from '@/lib/normalized-logging';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
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
    const offset = (page - 1) * pageSize;

    // Get total count for user's files (including multiple entries per tenant, excluding content tenant)
    let countSql = `
      SELECT COUNT(*) as total
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.UploadedBy = ? AND m.IsDeleted = 0 AND ma.TenantId != 'content'
    `;
    const countParams: any[] = [access.email];

    if (search) {
      countSql += ' AND m.FileName LIKE ?';
      countParams.push(`%${search}%`);
    }
    if (type !== 'all') {
      countSql += ' AND m.MediaType = ?';
      countParams.push(type);
    }

    const countResult = await db.prepare(countSql).bind(...countParams).first();
    const total = Number(countResult?.total ?? 0);

    // Get paginated results for user's files - one row per tenant (excluding content tenant)
    let sql = `
      SELECT m.*, t.Id as TenantId, t.Name as TenantName, COALESCE(m.Language, 'en') as Language
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      LEFT JOIN Tenants t ON ma.TenantId = t.Id
      WHERE m.UploadedBy = ? AND m.IsDeleted = 0 AND ma.TenantId != 'content'
    `;
    const params: any[] = [access.email];

    if (search) {
      sql += ' AND m.FileName LIKE ?';
      params.push(`%${search}%`);
    }
    if (type !== 'all') {
      sql += ' AND m.MediaType = ?';
      params.push(type);
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
    const result = await stmt.all();
    
    // Get published status for all files
    const fileIds = result.results.map((file: any) => file.Id);
    const publishedStatusQuery = fileIds.length > 0 
      ? `SELECT MediaId FROM PublishedContent WHERE MediaId IN (${fileIds.map(() => '?').join(',')})`
      : 'SELECT MediaId FROM PublishedContent WHERE 1=0';
    
    const publishedFiles = fileIds.length > 0 
      ? await db.prepare(publishedStatusQuery).bind(...fileIds).all()
      : { results: [] };
    
    const publishedFileIds = new Set(publishedFiles.results.map((row: any) => row.MediaId));
    
    // Transform the results to match the expected interface
    const transformedResults = result.results.map((file: any) => {
      return {
        Id: file.Id.toString(),
        FileName: file.FileName,
        FileSize: file.FileSize,
        ContentType: file.ContentType,
        MediaType: file.MediaType,
        UploadDate: file.UploadDate || new Date().toISOString(),
        Description: file.Description,
        Duration: file.Duration,
        Width: file.Width,
        Height: file.Height,
        TenantId: file.TenantId,
        TenantName: file.TenantName,
        R2Key: file.R2Key,
        UploadedBy: file.UploadedBy,
        IsPublished: publishedFileIds.has(file.Id)
      };
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
    console.error('Error fetching harbor media files:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author', 'subscriber', 'agent', 'reviewer', 'user']
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
    const language = formData.get('language') as string || 'en';
    let mediaType: 'audio' | 'video' | 'image' | 'document' = 'document';
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
        FileName, FileSize, ContentType, MediaType, R2Key, UploadedBy, Language
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      file.name,
      fileSize,
      contentType,
      mediaType,
      r2Key,
      access.email,
      language
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

    // Log the upload using normalized logging with proper column structure
    const normalizedLogging = new NormalizedLogging(db);
    const requestContext = extractRequestContext(request);
    
    const uploadMetadata = createNormalizedMetadata({
      fileName: file.name,
      fileSize,
      contentType,
      mediaType,
      selectedTenants,
      isAdmin,
      r2Key,
      language,
      uploadMethod: 'harbor_interface'
    }, language);

    await normalizedLogging.logMediaOperations({
      userEmail: access.email,
      provider: 'credentials',
      tenantId: selectedTenants[0],
      activityType: 'upload_file',
      accessType: 'write',
      targetId: mediaId.toString(),
      targetName: file.name,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: uploadMetadata
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
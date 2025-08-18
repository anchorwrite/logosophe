import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin, isTenantAdminFor, hasPermission } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { nanoid } from 'nanoid';
import { createMediaMetadata, MediaPublishMetadata } from '@/lib/media-metadata';


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if media file exists and get its tenant
    const mediaFile = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE m.Id = ? AND m.IsDeleted = 0
    `).bind(id).first() as any;

    if (!mediaFile) {
      return NextResponse.json({ error: 'Media file not found' }, { status: 404 });
    }

    // Check if user has publishing permission in the file's tenant
    const fileTenantId = mediaFile.TenantId || 'default';
    const canPublish = await hasPermission(access.email, fileTenantId, 'content', 'publish');
    const isAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = await isTenantAdminFor(access.email, fileTenantId);

    if (!canPublish && !isAdmin && !isTenantAdmin) {
      await systemLogs.createLog({
        logType: 'activity',
        timestamp: new Date().toISOString(),
        userEmail: access.email,
        activityType: 'UNAUTHORIZED_PUBLISH_ATTEMPT',
        targetId: id,
        targetName: `Media file ${id}`,
        metadata: { action: 'publish', mediaId: id, tenantId: fileTenantId }
      });

      return NextResponse.json({ error: 'You do not have permission to publish content' }, { status: 403 });
    }

    // Get request body
    const body = await request.json() as {
      publishingSettings?: {
        watermark?: boolean;
        disableCopy?: boolean;
        disableDownload?: boolean;
        addWatermark?: boolean;
      };
    };

    // Check if user has access to this media file
    const userAccess = await db.prepare(`
      SELECT 1 FROM MediaAccess ma
      JOIN TenantUsers tu ON ma.TenantId = tu.TenantId AND tu.Email = ?
      WHERE ma.MediaId = ?
    `).bind(access.email, id).first();

    if (!userAccess && !isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have access to this media file' }, { status: 403 });
    }

    // Check if content is already published
    const existingPublication = await db.prepare(`
      SELECT 1 FROM PublishedContent WHERE MediaId = ?
    `).bind(id).first();

    if (existingPublication) {
      return NextResponse.json({ error: 'Content is already published' }, { status: 409 });
    }

    // Create published content record
    const publishedContentId = nanoid();
    const now = new Date().toISOString();
    const publishingSettings = body.publishingSettings || {
      watermark: true,
      disableCopy: true,
      disableDownload: false,
      addWatermark: true
    };

    // Generate access token for public access (using same method as MediaLibrary share links)
    const accessToken = nanoid(32);

    await db.prepare(`
      INSERT INTO PublishedContent (Id, MediaId, PublisherId, PublishedAt, PublishingSettings, ApprovalStatus, CreatedAt, UpdatedAt, AccessToken)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      publishedContentId,
      id,
      access.email,
      now,
      JSON.stringify(publishingSettings),
      'approved',
      now,
      now,
      accessToken
    ).run();

    // Create token record for tracking
    await db.prepare(`
      INSERT INTO PublishedContentTokens (PublishedContentId, AccessToken, CreatedAt)
      VALUES (?, ?, ?)
    `).bind(publishedContentId, accessToken, now).run();

    // Add the file to the content tenant so subscribers can access it
    const contentTenantAccess = await db.prepare(`
      SELECT 1 FROM MediaAccess WHERE MediaId = ? AND TenantId = 'content'
    `).bind(id).first();

    if (!contentTenantAccess) {
      await db.prepare(`
        INSERT INTO MediaAccess (MediaId, TenantId, RoleId, AccessType, GrantedAt, GrantedBy)
        VALUES (?, 'content', 'tenant', 'view', ?, ?)
      `).bind(id, now, access.email).run();
    }

    // Log the publishing action with enhanced metadata
    const publishMetadata = createMediaMetadata<MediaPublishMetadata>({
      publishedContentId,
      publishingSettings,
      addedToContentTenant: !contentTenantAccess
    }, 'publish', id);

    await systemLogs.createLog({
      logType: 'activity',
      timestamp: now,
      userEmail: access.email,
      activityType: 'CONTENT_PUBLISHED',
      targetId: id,
      targetName: mediaFile.FileName,
      metadata: publishMetadata
    });

    return NextResponse.json({
      success: true,
      publishedContentId,
      message: 'Content published successfully'
    });

  } catch (error) {
    console.error('Error publishing content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user has unpublishing permission
    const canUnpublish = await hasPermission(access.email, 'content', 'content', 'unpublish');
    const isAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = await isTenantAdminFor(access.email, 'content');

    if (!canUnpublish && !isAdmin && !isTenantAdmin) {
      await systemLogs.createLog({
        logType: 'activity',
        timestamp: new Date().toISOString(),
        userEmail: access.email,
        activityType: 'UNAUTHORIZED_UNPUBLISH_ATTEMPT',
        targetId: id,
        targetName: `Media file ${id}`,
        metadata: { action: 'unpublish', mediaId: id }
      });

      return NextResponse.json({ error: 'You do not have permission to unpublish content' }, { status: 403 });
    }

    // Get the published content record
    const publishedContent = await db.prepare(`
      SELECT pc.*, m.FileName
      FROM PublishedContent pc
      JOIN MediaFiles m ON pc.MediaId = m.Id
      WHERE pc.MediaId = ?
    `).bind(id).first() as any;

    if (!publishedContent) {
      return NextResponse.json({ error: 'Content is not published' }, { status: 404 });
    }

    // Check if user is the publisher or has admin rights
    if (publishedContent.PublisherId !== access.email && !isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You can only unpublish content you published' }, { status: 403 });
    }

    // Delete the published content record
    await db.prepare(`
      DELETE FROM PublishedContent WHERE MediaId = ?
    `).bind(id).run();

    // Clean up token records
    await db.prepare(`
      DELETE FROM PublishedContentTokens WHERE PublishedContentId = ?
    `).bind(publishedContent.Id).run();

    // Remove the file from the content tenant when unpublishing
    await db.prepare(`
      DELETE FROM MediaAccess WHERE MediaId = ? AND TenantId = 'content'
    `).bind(id).run();

    // Log the unpublishing action with enhanced metadata
    const unpublishMetadata = createMediaMetadata<MediaPublishMetadata>({
      publishedContentId: publishedContent.Id,
      removedFromContentTenant: true
    }, 'unpublish', id);

    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      userEmail: access.email,
      activityType: 'CONTENT_UNPUBLISHED',
      targetId: id,
      targetName: publishedContent.FileName,
      metadata: unpublishMetadata
    });

    return NextResponse.json({
      success: true,
      message: 'Content unpublished successfully'
    });

  } catch (error) {
    console.error('Error unpublishing content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin, isTenantAdminFor, hasPermission } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { createMediaMetadata, MediaProtectionMetadata } from '@/lib/media-metadata';


export async function PUT(
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

    // Check if user has protection management permission
    const canManageProtection = await hasPermission(access.email, 'default', 'content', 'manage_protection');
    const isAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = await isTenantAdminFor(access.email, 'default');

    if (!canManageProtection && !isAdmin && !isTenantAdmin) {
      await systemLogs.createLog({
        logType: 'activity',
        timestamp: new Date().toISOString(),
        userEmail: access.email,
        activityType: 'UNAUTHORIZED_PROTECTION_SETTINGS_ATTEMPT',
        targetId: id,
        targetName: `Media file ${id}`,
        metadata: { action: 'update_protection_settings', mediaId: id }
      });

      return NextResponse.json({ error: 'You do not have permission to manage protection settings' }, { status: 403 });
    }

    // Get request body
    const body = await request.json() as {
      publishingSettings: {
        watermark?: boolean;
        disableCopy?: boolean;
        disableDownload?: boolean;
        addWatermark?: boolean;
      };
    };

    if (!body.publishingSettings) {
      return NextResponse.json({ error: 'Publishing settings are required' }, { status: 400 });
    }

    // Check if content is published
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
      return NextResponse.json({ error: 'You can only modify protection settings for content you published' }, { status: 403 });
    }

    // Update the publishing settings
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE PublishedContent 
      SET PublishingSettings = ?, UpdatedAt = ?
      WHERE MediaId = ?
    `).bind(
      JSON.stringify(body.publishingSettings),
      now,
      id
    ).run();

    // Log the protection settings update with enhanced metadata
    const protectionMetadata = createMediaMetadata<MediaProtectionMetadata>({
      publishingSettings: body.publishingSettings,
      publishedContentId: publishedContent.Id
    }, 'update_protection_settings', id);

    await systemLogs.createLog({
      logType: 'activity',
      timestamp: now,
      userEmail: access.email,
      activityType: 'PROTECTION_SETTINGS_UPDATED',
      targetId: id,
      targetName: publishedContent.FileName,
      metadata: protectionMetadata
    });

    return NextResponse.json({
      success: true,
      message: 'Protection settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating protection settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
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

    // Check if content is published
    const publishedContent = await db.prepare(`
      SELECT pc.*, m.FileName
      FROM PublishedContent pc
      JOIN MediaFiles m ON pc.MediaId = m.Id
      WHERE pc.MediaId = ?
    `).bind(id).first() as any;

    if (!publishedContent) {
      return NextResponse.json({ error: 'Content is not published' }, { status: 404 });
    }

    // Check if user has access to view protection settings
    const canViewProtection = await hasPermission(access.email, 'default', 'content', 'manage_protection');
    const isAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = await isTenantAdminFor(access.email, 'default');

    if (!canViewProtection && !isAdmin && !isTenantAdmin && publishedContent.PublisherId !== access.email) {
      return NextResponse.json({ error: 'You do not have permission to view protection settings' }, { status: 403 });
    }

    // Parse the publishing settings
    const publishingSettings = publishedContent.PublishingSettings 
      ? JSON.parse(publishedContent.PublishingSettings)
      : {
          watermark: true,
          disableCopy: true,
          disableDownload: false,
          addWatermark: true
        };

    return NextResponse.json({
      success: true,
      publishingSettings,
      publishedAt: publishedContent.PublishedAt,
      publisherId: publishedContent.PublisherId,
      approvalStatus: publishedContent.ApprovalStatus
    });

  } catch (error) {
    console.error('Error getting protection settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
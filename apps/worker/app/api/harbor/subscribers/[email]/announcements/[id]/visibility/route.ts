// Announcement Visibility Toggle API Route
// PATCH: Toggle announcement public/private visibility

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

interface VisibilityToggleRequest {
  isPublic: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const announcementId = parseInt(id, 10);
    const session = await auth();
    
    if (!session?.user?.email) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Users can only update their own announcements
    if (session.user.email !== email) {
      return Response.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (isNaN(announcementId)) {
      return Response.json(
        { success: false, error: 'Invalid announcement ID' },
        { status: 400 }
      );
    }

    const body: VisibilityToggleRequest = await request.json();
    const { isPublic } = body;

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Verify the announcement exists and belongs to this user
    const existingAnnouncement = await db.prepare(`
      SELECT sa.Id, sa.HandleId, sa.Title, sa.Content, sa.Link, sa.LinkText,
             sa.PublishedAt, sa.ExpiresAt, sa.IsActive, sa.IsPublic, sa.Language,
             sa.CreatedAt, sa.UpdatedAt,
             sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberAnnouncements sa
      INNER JOIN SubscriberHandles sh ON sa.HandleId = sh.Id
      WHERE sa.Id = ? AND sh.SubscriberEmail = ?
    `).bind(announcementId, email).first();

    if (!existingAnnouncement) {
      return Response.json(
        { success: false, error: 'Announcement not found' },
        { status: 404 }
      );
    }

    // Update the announcement visibility
    const updateResult = await db.prepare(`
      UPDATE SubscriberAnnouncements 
      SET IsPublic = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      isPublic ? 1 : 0,
      new Date().toISOString(),
      announcementId
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating announcement visibility:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update announcement visibility' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('visibility_updated', announcementId, email, {
      title: (existingAnnouncement as any).Title,
      handleId: (existingAnnouncement as any).HandleId,
      handle: (existingAnnouncement as any).Handle,
      isPublic,
      previousVisibility: (existingAnnouncement as any).IsPublic
    });

    return Response.json({
      success: true,
      data: {
        message: `Announcement made ${isPublic ? 'public' : 'private'} successfully`
      }
    });

  } catch (error) {
    console.error('Error updating announcement visibility:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

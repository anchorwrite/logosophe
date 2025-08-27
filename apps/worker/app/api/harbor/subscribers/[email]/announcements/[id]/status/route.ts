// Announcement Status Toggle API Route
// PATCH: Toggle announcement active/inactive status

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

interface StatusToggleRequest {
  isActive: boolean;
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

    const body: StatusToggleRequest = await request.json();
    const { isActive } = body;

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

    // Update the announcement status
    const updateResult = await db.prepare(`
      UPDATE SubscriberAnnouncements 
      SET IsActive = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      isActive ? 1 : 0,
      new Date().toISOString(),
      announcementId
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating announcement status:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update announcement status' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('status_updated', announcementId, email, {
      title: (existingAnnouncement as any).Title,
      handleId: (existingAnnouncement as any).HandleId,
      handle: (existingAnnouncement as any).Handle,
      isActive,
      previousStatus: (existingAnnouncement as any).IsActive
    });

    return Response.json({
      success: true,
      data: {
        message: `Announcement ${isActive ? 'activated' : 'deactivated'} successfully`
      }
    });

  } catch (error) {
    console.error('Error updating announcement status:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Hard Delete Announcement API Route
// DELETE: Permanently delete announcement and all associated data

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email, id } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const announcementId = parseInt(id);
    
    if (isNaN(announcementId)) {
      return new Response(JSON.stringify({ error: 'Invalid announcement ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can delete their own announcements, admins can delete any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify announcement exists and belongs to this subscriber
    const existingAnnouncement = await db.prepare(`
      SELECT sa.*, sh.SubscriberEmail 
      FROM SubscriberAnnouncements sa
      INNER JOIN SubscriberHandles sh ON sa.HandleId = sh.Id
      WHERE sa.Id = ? AND sh.SubscriberEmail = ?
    `).bind(announcementId, subscriberEmail).first();
    
    if (!existingAnnouncement) {
      return new Response(JSON.stringify({ error: 'Announcement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the action before deletion
    await logAnnouncementAction(
      'hard_deleted',
      announcementId,
      subscriberEmail,
      {
        title: existingAnnouncement.Title as string,
        handleId: (existingAnnouncement as any).HandleId.toString(),
        handle: (existingAnnouncement as any).Handle || 'unknown',
        isPublic: existingAnnouncement.IsPublic as boolean,
        isActive: existingAnnouncement.IsActive as boolean,
        language: existingAnnouncement.Language as string
      }
    );

    // Delete in order to maintain referential integrity
    // 1. Delete content links
    await db.prepare(`
      DELETE FROM ContentLinks 
      WHERE ContentType = 'announcement' AND ContentId = ?
    `).bind(announcementId).run();

    // 2. Finally delete the announcement
    const deleteResult = await db.prepare(`
      DELETE FROM SubscriberAnnouncements 
      WHERE Id = ?
    `).bind(announcementId).run();
    
    if (deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to delete announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Announcement permanently deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error hard deleting announcement:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

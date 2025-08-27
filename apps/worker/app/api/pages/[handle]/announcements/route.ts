import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get all active and public announcements for this handle
    const announcementsResult = await db.prepare(`
      SELECT 
        sa.Id, sa.HandleId, sa.Title, sa.Content, sa.Link, sa.LinkText,
        sa.PublishedAt, sa.ExpiresAt, sa.IsActive, sa.Language,
        sa.IsPublic, sa.CreatedAt, sa.UpdatedAt
      FROM SubscriberAnnouncements sa
      INNER JOIN SubscriberHandles sh ON sa.HandleId = sh.Id
      WHERE sh.Handle = ? 
        AND sa.IsActive = 1 
        AND sa.IsPublic = 1
        AND (sa.ExpiresAt IS NULL OR sa.ExpiresAt > ?)
      ORDER BY sa.PublishedAt DESC
    `).bind(handle, new Date().toISOString()).all();

    if (!announcementsResult.success) {
      console.error('Database error fetching announcements:', announcementsResult.error);
      return Response.json(
        { success: false, error: 'Failed to fetch announcements' },
        { status: 500 }
      );
    }

    const announcements = announcementsResult.results as any[];

    // Log the view action for analytics
    if (announcements.length > 0) {
      try {
        // For public views, we don't have specific announcement details
        // Just log that announcements were viewed for this handle
        console.log(`Announcements viewed for handle: ${handle}, count: ${announcements.length}`);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('Failed to log announcement view:', logError);
      }
    }

    return Response.json({
      success: true,
      data: announcements
    });

  } catch (error) {
    console.error('Error fetching announcements:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

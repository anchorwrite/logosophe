// Individual Subscriber Announcement API Route
// PUT: Update an announcement
// DELETE: Archive an announcement

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

interface UpdateAnnouncementRequest {
  title: string;
  content: string;
  link?: string;
  linkText?: string;
  isPublic: boolean;
  isActive: boolean;
  language: string;
}

export async function PUT(
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

    const body: UpdateAnnouncementRequest = await request.json();
    const { title, content, link, linkText, isPublic, isActive, language } = body;

    if (!title || !title.trim()) {
      return Response.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return Response.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

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

    // Update the announcement
    const updateResult = await db.prepare(`
      UPDATE SubscriberAnnouncements 
      SET Title = ?, Content = ?, Link = ?, LinkText = ?, 
          IsActive = ?, IsPublic = ?, Language = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      title.trim(),
      content.trim(),
      link?.trim() || null,
      linkText?.trim() || null,
      isActive ? 1 : 0,
      isPublic ? 1 : 0,
      language || 'en',
      new Date().toISOString(),
      announcementId
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating announcement:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update announcement' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('updated', announcementId, email, {
      title: title.trim(),
      handleId: (existingAnnouncement as any).HandleId,
      handle: (existingAnnouncement as any).Handle,
      isPublic,
      isActive,
      language
    });

    return Response.json({
      success: true,
      data: {
        message: 'Announcement updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating announcement:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Users can only delete their own announcements
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

    // Soft delete by setting IsActive to false
    const deleteResult = await db.prepare(`
      UPDATE SubscriberAnnouncements 
      SET IsActive = 0, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      new Date().toISOString(),
      announcementId
    ).run();

    if (!deleteResult.success) {
      console.error('Database error archiving announcement:', deleteResult.error);
      return Response.json(
        { success: false, error: 'Failed to archive announcement' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('archived', announcementId, email, {
      title: (existingAnnouncement as any).Title,
      handleId: (existingAnnouncement as any).HandleId,
      handle: (existingAnnouncement as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        message: 'Announcement archived successfully'
      }
    });

  } catch (error) {
    console.error('Error archiving announcement:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

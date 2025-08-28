// Subscriber Announcements API Route
// GET: List announcements for a subscriber
// POST: Create a new announcement

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { SubscriberAnnouncement } from '@/types/subscriber-pages';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

interface CreateAnnouncementRequest {
  title: string;
  content: string;
  link?: string;
  linkText?: string;
  handleId: number;
  isPublic: boolean;
  isActive: boolean;
  language: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Users can only view their own announcements
    if (session.user.email !== email) {
      return Response.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const language = searchParams.get('language');
    const handleId = searchParams.get('handleId');
    
    // Build WHERE clause with filters
    let whereClause = 'sh.SubscriberEmail = ?';
    const dbParams: any[] = [email];
    
    // Only apply status filter if specifically requested
    // When no status filter is applied, show ALL announcements (draft + published + archived)
    if (status === 'draft') {
      whereClause += ' AND sa.IsActive = 0 AND sa.IsPublic = 0';
    } else if (status === 'published') {
      whereClause += ' AND sa.IsActive = 1 AND sa.IsPublic = 1';
    } else if (status === 'archived') {
      whereClause += ' AND sa.IsActive = 0 AND sa.IsPublic = 1';
    }
    // If status is null or 'all', no additional filter is added, so all announcements are shown
    
    if (language && language !== 'all') {
      whereClause += ' AND sa.Language = ?';
      dbParams.push(language);
    }
    
    if (handleId && handleId !== 'all') {
      whereClause += ' AND sa.HandleId = ?';
      dbParams.push(parseInt(handleId));
    }
    
    // Get filtered announcements for this subscriber
    const announcementsResult = await db.prepare(`
      SELECT 
        sa.Id, sa.HandleId, sa.Title, sa.Content, sa.Link, sa.LinkText,
        sa.PublishedAt, sa.ExpiresAt, sa.IsActive, sa.IsPublic, sa.Language,
        sa.CreatedAt, sa.UpdatedAt,
        sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberAnnouncements sa
      INNER JOIN SubscriberHandles sh ON sa.HandleId = sh.Id
      WHERE ${whereClause}
      ORDER BY sa.CreatedAt DESC
    `).bind(...dbParams).all();

    if (!announcementsResult.success) {
      console.error('Database error fetching announcements:', announcementsResult.error);
      return Response.json(
        { success: false, error: 'Failed to fetch announcements' },
        { status: 500 }
      );
    }

    const announcements = announcementsResult.results as unknown as SubscriberAnnouncement[];

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Users can only create announcements for themselves
    if (session.user.email !== email) {
      return Response.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body: CreateAnnouncementRequest = await request.json();
    const { title, content, link, linkText, handleId, isPublic, isActive, language } = body;

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

    if (!handleId || isNaN(handleId)) {
      return Response.json(
        { success: false, error: 'Valid handle ID is required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Verify the handle exists and belongs to this subscriber
    const handleResult = await db.prepare(`
      SELECT Id, Handle, DisplayName
      FROM SubscriberHandles
      WHERE Id = ? AND SubscriberEmail = ? AND IsActive = 1
    `).bind(handleId, email).first();

    if (!handleResult) {
      return Response.json(
        { success: false, error: 'Handle not found or access denied. Please select a valid handle.' },
        { status: 400 }
      );
    }

    // Create the announcement
    const insertResult = await db.prepare(`
      INSERT INTO SubscriberAnnouncements (
        HandleId, Title, Content, Link, LinkText, PublishedAt, 
        ExpiresAt, IsActive, IsPublic, Language, CreatedAt, UpdatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      handleId,
      title.trim(),
      content.trim(),
      link?.trim() || null,
      linkText?.trim() || null,
      new Date().toISOString(),
      null, // No expiration date
      isActive ? 1 : 0,
      isPublic ? 1 : 0,
      language || 'en',
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    if (!insertResult.success) {
      console.error('Database error creating announcement:', insertResult.error);
      return Response.json(
        { success: false, error: 'Failed to create announcement' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('created', insertResult.meta.last_row_id, email, {
      title: title.trim(),
      handleId: handleId,
      handle: (handleResult as any).Handle,
      isPublic,
      isActive,
      language
    });

    return Response.json({
      success: true,
      data: {
        Id: insertResult.meta.last_row_id,
        message: 'Announcement created successfully'
      }
    });

  } catch (error) {
    console.error('Error creating announcement:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

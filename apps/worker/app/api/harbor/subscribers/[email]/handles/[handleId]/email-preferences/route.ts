import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// GET /api/harbor/subscribers/[email]/handles/[handleId]/email-preferences - Get handle-specific email preferences
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; handleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, handleId } = await params;
    
    // Users can only access their own email preferences
    if (session.user.email !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the handle belongs to the subscriber
    const handle = await db.prepare(`
      SELECT Id, DisplayName, Description 
      FROM SubscriberHandles 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(parseInt(handleId), email).first() as { Id: number; DisplayName: string; Description?: string } | undefined;

    if (!handle) {
      return NextResponse.json({ error: 'Handle not found or access denied' }, { status: 404 });
    }

    // Get handle-specific email preferences from the Subscribers table
    // We'll store handle preferences in the EmailPreferences JSON as a nested structure
    const subscriber = await db.prepare(`
      SELECT EmailPreferences FROM Subscribers WHERE Email = ?
    `).bind(email).first() as { EmailPreferences: string } | undefined;

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    let allPreferences;
    try {
      allPreferences = JSON.parse(subscriber.EmailPreferences || '{}');
    } catch (error) {
      allPreferences = {};
    }

    // Extract handle-specific preferences
    const handlePreferences = allPreferences[`handle_${handleId}`] || {
      handle_updates: true,
      blog_updates: true,
      content_updates: true,
      announcements: true
    };

    return NextResponse.json({ 
      preferences: handlePreferences,
      handle: {
        id: handle.Id,
        name: handle.DisplayName,
        description: handle.Description
      }
    });
  } catch (error) {
    console.error('Error fetching handle email preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/harbor/subscribers/[email]/handles/[handleId]/email-preferences - Update handle-specific email preferences
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; handleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, handleId } = await params;
    
    // Users can only update their own email preferences
    if (session.user.email !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { preferences } = await request.json() as { preferences: Record<string, boolean> };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences format' }, { status: 400 });
    }

    // Validate preference values
    const validHandlePreferences = {
      handle_updates: Boolean(preferences.handle_updates),
      blog_updates: Boolean(preferences.blog_updates),
      content_updates: Boolean(preferences.content_updates),
      announcements: Boolean(preferences.announcements)
    };

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the handle belongs to the subscriber
    const handle = await db.prepare(`
      SELECT Id FROM SubscriberHandles 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(parseInt(handleId), email).first() as { Id: number } | undefined;

    if (!handle) {
      return NextResponse.json({ error: 'Handle not found or access denied' }, { status: 404 });
    }

    // Get current email preferences
    const subscriber = await db.prepare(`
      SELECT EmailPreferences FROM Subscribers WHERE Email = ?
    `).bind(email).first() as { EmailPreferences: string } | undefined;

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    // Parse existing preferences and update handle-specific section
    let allPreferences;
    try {
      allPreferences = JSON.parse(subscriber.EmailPreferences || '{}');
    } catch (error) {
      allPreferences = {};
    }

    // Update handle-specific preferences
    allPreferences[`handle_${handleId}`] = validHandlePreferences;

    // Update subscriber's email preferences
    const result = await db.prepare(`
      UPDATE Subscribers 
      SET EmailPreferences = ?, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(JSON.stringify(allPreferences), email).run();

    if ((result as any).changes === 0) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      preferences: validHandlePreferences,
      message: 'Handle email preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating handle email preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// GET /api/harbor/subscribers/[email]/email-preferences - Get email preferences
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await params;
    
    // Users can only access their own email preferences
    if (session.user.email !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get subscriber's email preferences
    const subscriber = await db.prepare(`
      SELECT EmailPreferences FROM Subscribers WHERE Email = ?
    `).bind(email).first() as { EmailPreferences: string } | undefined;

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    let preferences;
    try {
      preferences = JSON.parse(subscriber.EmailPreferences || '{}');
    } catch (error) {
      // If preferences are invalid JSON, return defaults
      preferences = {
        newsletters: true,
        announcements: true,
        role_updates: true,
        tenant_updates: true,
        workflow_updates: true,
        handle_updates: true,
        blog_updates: true,
        content_updates: true,
        welcome: true
      };
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/harbor/subscribers/[email]/email-preferences - Update email preferences
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await params;
    
    // Users can only update their own email preferences
    if (session.user.email !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { preferences } = await request.json() as { preferences: Record<string, boolean> };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences format' }, { status: 400 });
    }

    // Validate preference values
    const validPreferences = {
      newsletters: Boolean(preferences.newsletters),
      announcements: Boolean(preferences.announcements),
      role_updates: Boolean(preferences.role_updates),
      tenant_updates: Boolean(preferences.tenant_updates),
      workflow_updates: Boolean(preferences.workflow_updates),
      handle_updates: Boolean(preferences.handle_updates),
      blog_updates: Boolean(preferences.blog_updates),
      content_updates: Boolean(preferences.content_updates),
      welcome: Boolean(preferences.welcome)
    };

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Update subscriber's email preferences
    const result = await db.prepare(`
      UPDATE Subscribers 
      SET EmailPreferences = ?, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(JSON.stringify(validPreferences), email).run();

    if ((result as any).changes === 0) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      preferences: validPreferences,
      message: 'Email preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

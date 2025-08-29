import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// GET /api/unsubscribe/[token] - Unsubscribe from emails with token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const handleId = searchParams.get('handle');
    
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Find the unsubscribe token
    const unsubscribeRecord = await db.prepare(`
      SELECT Id, Email, Token, EmailType, CreatedAt, ExpiresAt, UsedAt
      FROM UnsubscribeTokens 
      WHERE Token = ? AND (ExpiresAt IS NULL OR ExpiresAt > CURRENT_TIMESTAMP)
    `).bind(token).first() as {
      Id: number;
      Email: string;
      Token: string;
      EmailType: string;
      CreatedAt: string;
      ExpiresAt: string | null;
      UsedAt: string | null;
    } | undefined;

    if (!unsubscribeRecord) {
      return NextResponse.json({ 
        error: 'Invalid or expired unsubscribe token',
        message: 'This unsubscribe link is invalid or has expired.'
      }, { status: 400 });
    }

    if (unsubscribeRecord.UsedAt) {
      return NextResponse.json({ 
        error: 'Token already used',
        message: 'This unsubscribe link has already been used.',
        email: unsubscribeRecord.Email
      }, { status: 400 });
    }

    // Mark token as used
    const updateResult = await db.prepare(`
      UPDATE UnsubscribeTokens 
      SET UsedAt = CURRENT_TIMESTAMP 
      WHERE Id = ?
    `).bind(unsubscribeRecord.Id).run();

    if ((updateResult as any).changes === 0) {
      return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 });
    }

    // Update subscriber's email preferences based on the unsubscribe type
    if (unsubscribeRecord.EmailType === 'all') {
      // Unsubscribe from all emails
      const subscriberResult = await db.prepare(`
        UPDATE Subscribers 
        SET EmailPreferences = '{"newsletters":false,"announcements":false,"role_updates":false,"tenant_updates":false,"workflow_updates":false,"handle_updates":false,"blog_updates":false,"content_updates":false,"welcome":false}', 
        UpdatedAt = CURRENT_TIMESTAMP 
        WHERE Email = ?
      `).bind(unsubscribeRecord.Email).run();

          if ((subscriberResult as any).changes === 0) {
      console.warn(`Subscriber not found for unsubscribe: ${unsubscribeRecord.Email}`);
    }
    } else if (handleId && unsubscribeRecord.EmailType.startsWith('handle_')) {
      // Handle-specific unsubscribe
      const subscriber = await db.prepare(`
        SELECT EmailPreferences FROM Subscribers WHERE Email = ?
      `).bind(unsubscribeRecord.Email).first() as { EmailPreferences: string } | undefined;

      if (subscriber) {
        try {
          let preferences = JSON.parse(subscriber.EmailPreferences || '{}');
          
          // Update handle-specific preferences
          if (preferences[`handle_${handleId}`]) {
            preferences[`handle_${handleId}`] = {
              handle_updates: false,
              blog_updates: false,
              content_updates: false,
              announcements: false
            };
          }

          // Update general preferences if it's a general handle email type
          if (unsubscribeRecord.EmailType === 'handle_updates') {
            preferences.handle_updates = false;
          } else if (unsubscribeRecord.EmailType === 'blog_updates') {
            preferences.blog_updates = false;
          } else if (unsubscribeRecord.EmailType === 'content_updates') {
            preferences.content_updates = false;
          } else if (unsubscribeRecord.EmailType === 'announcements') {
            preferences.announcements = false;
          }

          const updateResult = await db.prepare(`
            UPDATE Subscribers 
            SET EmailPreferences = ?, UpdatedAt = CURRENT_TIMESTAMP 
            WHERE Email = ?
          `).bind(JSON.stringify(preferences), unsubscribeRecord.Email).run();

          if ((updateResult as any).changes === 0) {
            console.warn(`Failed to update subscriber preferences for: ${unsubscribeRecord.Email}`);
          }
        } catch (error) {
          console.error('Error parsing email preferences:', error);
        }
      }
    } else {
      // Specific email type unsubscribe
      const subscriber = await db.prepare(`
        SELECT EmailPreferences FROM Subscribers WHERE Email = ?
      `).bind(unsubscribeRecord.Email).first() as { EmailPreferences: string } | undefined;

      if (subscriber) {
        try {
          let preferences = JSON.parse(subscriber.EmailPreferences || '{}');
          preferences[unsubscribeRecord.EmailType] = false;

          const updateResult = await db.prepare(`
            UPDATE Subscribers 
            SET EmailPreferences = ?, UpdatedAt = CURRENT_TIMESTAMP 
            WHERE Email = ?
          `).bind(JSON.stringify(preferences), unsubscribeRecord.Email).run();

          if ((updateResult as any).changes === 0) {
            console.warn(`Failed to update subscriber preferences for: ${unsubscribeRecord.Email}`);
          }
        } catch (error) {
          console.error('Error parsing email preferences:', error);
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Successfully unsubscribed from emails',
      email: unsubscribeRecord.Email,
      emailType: unsubscribeRecord.EmailType,
      handleId: handleId,
      unsubscribedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/unsubscribe/[token] - Alternative unsubscribe method
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Same logic as GET for flexibility
  return GET(request, { params });
}

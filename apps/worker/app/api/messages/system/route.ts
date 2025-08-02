import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { 
  getSystemSettings, 
  updateSystemSetting, 
  logMessagingActivity,
  isMessagingEnabled 
} from '@/lib/messaging';
import type { SystemControlRequest, GetSystemStatusResponse } from '@/types/messaging';

export const runtime = 'edge';

// GET /api/messages/system - Get system status and settings
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get system settings
    const settings = await getSystemSettings();
    
    // Get system statistics
    const totalMessages = await db.prepare(`
      SELECT COUNT(*) as count FROM Messages WHERE IsDeleted = FALSE
    `).first() as { count: number };

    const activeUsers = await db.prepare(`
      SELECT COUNT(DISTINCT Email) as count FROM TenantUsers
    `).first() as { count: number };

    const blockedUsers = await db.prepare(`
      SELECT COUNT(*) as count FROM UserBlocks WHERE IsActive = TRUE
    `).first() as { count: number };

    const response: GetSystemStatusResponse = {
      messagingEnabled: settings.messaging_enabled === 'true',
      rateLimitSeconds: parseInt(settings.messaging_rate_limit || '60'),
      maxRecipients: parseInt(settings.messaging_max_recipients || '100'),
      recallWindowSeconds: parseInt(settings.messaging_recall_window || '3600'),
      messageExpirySeconds: parseInt(settings.messaging_message_expiry || '2592000'),
      totalMessages: totalMessages.count,
      activeUsers: activeUsers.count,
      blockedUsers: blockedUsers.count
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/messages/system - Update system settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as SystemControlRequest;
    const { action, value } = body;

    let settingKey = '';
    let settingValue = '';

    switch (action) {
      case 'toggle_system':
        settingKey = 'messaging_enabled';
        settingValue = value ? 'true' : 'false';
        break;

      case 'set_rate_limit':
        settingKey = 'messaging_rate_limit';
        settingValue = value.toString();
        if (isNaN(parseInt(settingValue)) || parseInt(settingValue) < 1) {
          return NextResponse.json({ error: 'Rate limit must be a positive number' }, { status: 400 });
        }
        break;

      case 'set_max_recipients':
        settingKey = 'messaging_max_recipients';
        settingValue = value.toString();
        if (isNaN(parseInt(settingValue)) || parseInt(settingValue) < 1) {
          return NextResponse.json({ error: 'Max recipients must be a positive number' }, { status: 400 });
        }
        break;

      case 'set_recall_window':
        settingKey = 'messaging_recall_window';
        settingValue = value.toString();
        if (isNaN(parseInt(settingValue)) || parseInt(settingValue) < 0) {
          return NextResponse.json({ error: 'Recall window must be a non-negative number' }, { status: 400 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update the setting
    await updateSystemSetting(settingKey, settingValue, session.user.email);

    // Log the system change
    await logMessagingActivity(
      'UPDATE_SYSTEM_SETTING',
      session.user.email,
      '',
      settingKey,
      `Updated ${settingKey} to ${settingValue}`,
      { action, value }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating system settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/messages/system/cleanup - Clean up old messages and rate limits
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as { action: string };
    const { action } = body;

    switch (action) {
      case 'cleanup_expired_messages':
        // Get message expiry setting
        const settings = await getSystemSettings();
        const expirySeconds = parseInt(settings.messaging_message_expiry || '2592000'); // 30 days
        
        // Delete messages older than expiry
        const deletedMessages = await db.prepare(`
          DELETE FROM Messages 
          WHERE CreatedAt < datetime('now', '-' || ? || ' seconds')
          AND IsDeleted = FALSE
        `).bind(expirySeconds).run();

        await logMessagingActivity(
          'CLEANUP_EXPIRED_MESSAGES',
          session.user.email,
          '',
          deletedMessages.meta.changes?.toString() || '0',
          `Cleaned up ${deletedMessages.meta.changes || 0} expired messages`
        );
        break;

      case 'cleanup_rate_limits':
        // Clean up expired rate limit entries
        const deletedRateLimits = await db.prepare(`
          DELETE FROM MessageRateLimits 
          WHERE ResetAt < datetime('now')
        `).run();

        await logMessagingActivity(
          'CLEANUP_RATE_LIMITS',
          session.user.email,
          '',
          deletedRateLimits.meta.changes?.toString() || '0',
          `Cleaned up ${deletedRateLimits.meta.changes || 0} expired rate limit entries`
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid cleanup action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
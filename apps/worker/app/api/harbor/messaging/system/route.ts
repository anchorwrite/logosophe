import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getSystemSettings } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (!isAdmin) {
      // Log unauthorized access attempt
      await systemLogs.createLog({
        logType: 'activity',
        timestamp: new Date().toISOString(),
        userEmail: access.email,
        activityType: 'unauthorized_system_access',
        metadata: { attemptedAccess: 'messaging-system' }
      });
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Log successful access
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: access.email,
              activityType: 'access_system_controls',
    });

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';

    // Get system settings
    const settings = await getSystemSettings();
    
    const response: any = {
      messagingEnabled: settings.messaging_enabled === 'true',
      rateLimitSeconds: parseInt(settings.messaging_rate_limit || '60'),
      maxRecipients: parseInt(settings.messaging_max_recipients || '100'),
      recallWindowSeconds: parseInt(settings.messaging_recall_window || '3600'),
      messageExpiryDays: parseInt(settings.messaging_expiry_days || '30')
    };

    if (includeStats) {
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

      const recentMessages = await db.prepare(`
        SELECT COUNT(*) as count FROM Messages 
        WHERE CreatedAt > datetime('now', '-7 days') AND IsDeleted = FALSE
      `).first() as { count: number };

      response.totalMessages = totalMessages.count;
      response.activeUsers = activeUsers.count;
      response.blockedUsers = blockedUsers.count;
      response.recentMessages = recentMessages.count;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in system API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as { setting: string; value: any };
    const { setting, value } = body;

    if (!setting || value === undefined) {
      return NextResponse.json({ error: 'Missing setting or value' }, { status: 400 });
    }

    // Update the setting in the database
    const settingMap: Record<string, string> = {
      messagingEnabled: 'messaging_enabled',
      rateLimitSeconds: 'messaging_rate_limit',
      maxRecipients: 'messaging_max_recipients',
      recallWindowSeconds: 'messaging_recall_window',
      messageExpiryDays: 'messaging_expiry_days'
    };

    const dbSetting = settingMap[setting];
    if (!dbSetting) {
      return NextResponse.json({ error: 'Invalid setting' }, { status: 400 });
    }

    await db.prepare(`
      INSERT OR REPLACE INTO SystemSettings (SettingKey, SettingValue, UpdatedAt, UpdatedBy)
      VALUES (?, ?, datetime('now'), ?)
    `).bind(dbSetting, value.toString(), access.email).run();

    // Log the setting change
    await systemLogs.logMessagingOperation({
      userEmail: access.email,
              activityType: 'system_setting_changed',
      targetId: dbSetting,
      targetName: setting,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { setting: dbSetting, value: value.toString() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating system setting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
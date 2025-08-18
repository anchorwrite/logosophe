import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { checkAccess } from '@/lib/access-control';
import { getSystemSettings } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { SystemControlsClient } from './SystemControlsClient';


export default async function SystemControlsPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin']
  });

  if (!access.hasAccess) {
    redirect('/dashboard/messaging');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user is system admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'UNAUTHORIZED_SYSTEM_ACCESS',
      metadata: { attemptedAccess: 'messaging-system' }
    });
    
    redirect('/dashboard/messaging');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_SYSTEM_CONTROLS'
  });

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

  const recentMessages = await db.prepare(`
    SELECT COUNT(*) as count FROM Messages 
    WHERE CreatedAt > datetime('now', '-7 days') AND IsDeleted = FALSE
  `).first() as { count: number };

  const initialData = {
    settings: {
      messagingEnabled: settings.messaging_enabled === 'true',
      rateLimitSeconds: parseInt(settings.messaging_rate_limit || '60'),
      maxRecipients: parseInt(settings.messaging_max_recipients || '100'),
      recallWindowSeconds: parseInt(settings.messaging_recall_window || '3600'),
      messageExpiryDays: parseInt(settings.messaging_expiry_days || '30')
    },
    stats: {
      totalMessages: totalMessages.count,
      activeUsers: activeUsers.count,
      blockedUsers: blockedUsers.count,
      recentMessages: recentMessages.count
    }
  };

  return <SystemControlsClient initialData={initialData} />;
} 
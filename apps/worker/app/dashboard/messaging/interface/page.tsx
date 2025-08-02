import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants, getSystemSettings } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { MessagingInterface } from './MessagingInterface';
import type { D1Result } from '@cloudflare/workers-types';


interface RecentMessage {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  SenderName: string;
  CreatedAt: string;
  IsRead: boolean;
  MessageType: string;
  RecipientCount: number;
}

interface UserStats {
  totalMessages: number;
  unreadMessages: number;
  sentMessages: number;
  activeConversations: number;
}

export default async function MessagingInterfacePage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if messaging is enabled
  const settings = await getSystemSettings();
  if (settings.messaging_enabled !== 'true') {
    redirect('/dashboard/messaging');
  }

  // Check if user has access to messaging
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const accessibleTenants = await getUserMessagingTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    redirect('/dashboard/messaging');
  }

  // Log access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_MESSAGING_INTERFACE'
  });

  // Get user's recent messages
  const recentMessagesQuery = `
    SELECT 
      m.Id,
      m.Subject,
      m.Body,
      m.SenderEmail,
      s.Name as SenderName,
      m.CreatedAt,
      CASE WHEN mr.RecipientEmail = ? THEN mr.IsRead ELSE FALSE END as IsRead,
      m.MessageType,
      COUNT(DISTINCT mr.RecipientEmail) as RecipientCount
    FROM Messages m
    LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
    LEFT JOIN Subscribers s ON m.SenderEmail = s.Email
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND m.IsDeleted = FALSE
    GROUP BY m.Id
    ORDER BY m.CreatedAt DESC
    LIMIT 20
  `;

  const recentMessagesResult = await db.prepare(recentMessagesQuery)
    .bind(session.user.email, session.user.email, session.user.email)
    .all() as D1Result<RecentMessage>;
  
  const recentMessages = recentMessagesResult.results || [];

  // Get user statistics
  const statsQuery = `
    SELECT 
      COUNT(DISTINCT m.Id) as totalMessages,
      COUNT(DISTINCT CASE WHEN mr.RecipientEmail = ? AND mr.IsRead = FALSE THEN m.Id END) as unreadMessages,
      COUNT(DISTINCT CASE WHEN m.SenderEmail = ? THEN m.Id END) as sentMessages,
      COUNT(DISTINCT CASE WHEN mr.RecipientEmail = ? THEN m.Id END) as receivedMessages
    FROM Messages m
    LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND m.IsDeleted = FALSE
  `;

  const statsResult = await db.prepare(statsQuery)
    .bind(session.user.email, session.user.email, session.user.email, session.user.email, session.user.email)
    .first() as any;

  const userStats: UserStats = {
    totalMessages: statsResult?.totalMessages || 0,
    unreadMessages: statsResult?.unreadMessages || 0,
    sentMessages: statsResult?.sentMessages || 0,
    activeConversations: recentMessages.length
  };

  // Get available recipients for the user
  const recipientsQuery = `
    SELECT 
      tu.Email,
      s.Name,
      tu.TenantId,
      tu.RoleId,
      FALSE as IsOnline,
      CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
    FROM TenantUsers tu
    LEFT JOIN Subscribers s ON tu.Email = s.Email
    LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
    WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
    AND s.Active = TRUE AND s.Banned = FALSE
    AND tu.Email != ?
    ORDER BY s.Name, tu.Email
  `;

  const recipientsResult = await db.prepare(recipientsQuery)
    .bind(...accessibleTenants, session.user.email)
    .all() as D1Result<any>;
  
  const recipients = recipientsResult.results || [];

  const systemSettings = {
    messagingEnabled: settings.messaging_enabled === 'true',
    rateLimitSeconds: Number(settings.messaging_rate_limit) || 60,
    maxRecipients: Number(settings.messaging_max_recipients) || 10,
    recallWindowSeconds: Number(settings.messaging_recall_window) || 300,
    messageExpiryDays: Number(settings.messaging_expiry_days) || 30,
  };

  return (
    <MessagingInterface 
      userEmail={session.user.email}
      userName={session.user.name || session.user.email}
      recentMessages={recentMessages}
      userStats={userStats}
      recipients={recipients}
      accessibleTenants={accessibleTenants}
      systemSettings={systemSettings}
    />
  );
} 
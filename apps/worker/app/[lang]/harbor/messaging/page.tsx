import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSystemSettings } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { SubscriberMessagingInterface } from './SubscriberMessagingInterface';
import type { D1Result } from '@cloudflare/workers-types';

export const runtime = 'edge';

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

export default async function SubscriberMessagingPage({ params }: { params: Promise<{ lang: string }> }) {
  const session = await auth();
  const { lang } = await params;
  
  console.log('Messaging page - User email:', session?.user?.email);
  console.log('Messaging page - User role:', session?.user?.role);
  
  if (!session?.user?.email) {
    console.log('Messaging page - No session, redirecting to signin');
    redirect('/signin');
  }

  // Only subscribers can access this page
  if (session.user.role !== 'subscriber') {
    console.log('Messaging page - User role is not subscriber, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if messaging is enabled
  const settings = await getSystemSettings();
  console.log('Messaging page - All settings:', settings);
  console.log('Messaging page - Messaging enabled:', settings.messaging_enabled);
  if (settings.messaging_enabled !== 'true') {
    console.log('Messaging page - Messaging disabled, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  // Get user's tenant information
  const userTenantQuery = `
    SELECT tu.TenantId, tu.RoleId, t.Name as TenantName
    FROM TenantUsers tu
    LEFT JOIN Tenants t ON tu.TenantId = t.Id
    WHERE tu.Email = ?
  `;

  const userTenantResult = await db.prepare(userTenantQuery)
    .bind(session.user.email)
    .first() as any;

  console.log('Messaging page - User tenant result:', userTenantResult);

  if (!userTenantResult?.TenantId) {
    console.log('Messaging page - No tenant found, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  const userTenantId = userTenantResult.TenantId;
  const userTenantName = userTenantResult.TenantName || userTenantId;

  // Log access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_SUBSCRIBER_MESSAGING',
    tenantId: userTenantId
  });

  // Get user's recent messages within their tenant
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
    LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
    LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
    AND m.IsDeleted = FALSE
    AND m.MessageType = 'subscriber'
    GROUP BY m.Id
    ORDER BY m.CreatedAt DESC
    LIMIT 20
  `;

  const recentMessagesResult = await db.prepare(recentMessagesQuery)
    .bind(session.user.email, session.user.email, session.user.email, userTenantId, userTenantId)
    .all() as D1Result<RecentMessage>;
  
  const recentMessages = recentMessagesResult.results || [];

  // Get user statistics within their tenant
  const statsQuery = `
    SELECT 
      COUNT(DISTINCT m.Id) as totalMessages,
      COUNT(DISTINCT CASE WHEN mr.RecipientEmail = ? AND mr.IsRead = FALSE THEN m.Id END) as unreadMessages,
      COUNT(DISTINCT CASE WHEN m.SenderEmail = ? THEN m.Id END) as sentMessages,
      COUNT(DISTINCT CASE WHEN mr.RecipientEmail = ? THEN m.Id END) as receivedMessages
    FROM Messages m
    LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
    LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
    LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
    AND m.IsDeleted = FALSE
    AND m.MessageType = 'subscriber'
  `;

  const statsResult = await db.prepare(statsQuery)
    .bind(session.user.email, session.user.email, session.user.email, session.user.email, session.user.email, userTenantId, userTenantId)
    .first() as any;

  // Count only messages that have recipients (active conversations)
  // Count unique conversations (pairs of participants who have exchanged messages)
  const conversationsQuery = `
    WITH ConversationPairs AS (
      SELECT DISTINCT
        CASE 
          WHEN m.SenderEmail = ? THEN mr.RecipientEmail
          ELSE m.SenderEmail
        END as OtherParticipant
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
      LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
      WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
      AND m.IsDeleted = FALSE
      AND m.MessageType = 'subscriber'
      AND mr.RecipientEmail IS NOT NULL
    )
    SELECT COUNT(*) as conversationCount
    FROM ConversationPairs
  `;

  const conversationsResult = await db.prepare(conversationsQuery)
    .bind(session.user.email, session.user.email, session.user.email, userTenantId, userTenantId)
    .first() as { conversationCount: number };

  const activeConversationsCount = conversationsResult?.conversationCount || 0;

  const userStats: UserStats = {
    totalMessages: statsResult?.totalMessages || 0,
    unreadMessages: statsResult?.unreadMessages || 0,
    sentMessages: statsResult?.sentMessages || 0,
    activeConversations: activeConversationsCount
  };

  // Get available recipients within the same tenant
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
    LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
    LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
    WHERE tu.TenantId = ?
    AND s.Active = TRUE AND s.Banned = FALSE
    AND tu.Email != ?
    AND ur.RoleId = 'subscriber'
    ORDER BY s.Name, tu.Email
  `;

  const recipientsResult = await db.prepare(recipientsQuery)
    .bind(userTenantId, session.user.email)
    .all() as D1Result<any>;
  
  const recipients = recipientsResult.results || [];

  const systemSettings = {
    messagingEnabled: settings.messaging_enabled === 'true',
    rateLimitSeconds: Number(settings.messaging_rate_limit) || 60,
    maxRecipients: Number(settings.messaging_max_recipients) || 10,
    recallWindowSeconds: Number(settings.messaging_recall_window) || 300,
    messageExpiryDays: Number(settings.messaging_message_expiry) || 30,
  };

  return (
    <SubscriberMessagingInterface 
      userEmail={session.user.email}
      userName={session.user.name || session.user.email}
      userTenantId={userTenantId}
      userTenantName={userTenantName}
      recentMessages={recentMessages}
      userStats={userStats}
      recipients={recipients}
      systemSettings={systemSettings}
    />
  );
} 
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSystemSettings } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { SubscriberMessagingInterface } from './SubscriberMessagingInterface';
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

export default async function SubscriberMessagingPage({ params }: { params: Promise<{ lang: string }> }) {
  const session = await auth();
  const { lang } = await params;
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Only subscribers can access this page
  if (session.user.role !== 'subscriber') {
    redirect(`/${lang}/harbor`);
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  // Check if messaging is enabled
  const settings = await getSystemSettings();
  if (settings.messaging_enabled !== 'true') {
    redirect(`/${lang}/harbor`);
  }

  // Get user's tenant information (all tenants)
  const userTenantsQuery = `
    SELECT tu.TenantId, tu.RoleId, t.Name as TenantName
    FROM TenantUsers tu
    LEFT JOIN Tenants t ON tu.TenantId = t.Id
    WHERE tu.Email = ?
    UNION ALL
    SELECT ur.TenantId, ur.RoleId, t.Name as TenantName
    FROM UserRoles ur
    LEFT JOIN Tenants t ON ur.TenantId = t.Id
    WHERE ur.Email = ? AND ur.RoleId = 'subscriber'
  `;

  const userTenantsResult = await db.prepare(userTenantsQuery)
    .bind(session.user.email, session.user.email)
    .all() as any;

  if (!userTenantsResult?.results || userTenantsResult.results.length === 0) {
    redirect(`/${lang}/harbor`);
  }

  // Remove duplicates and organize by tenant
  const tenantMap = new Map();
  userTenantsResult.results.forEach((tenant: any) => {
    if (!tenantMap.has(tenant.TenantId)) {
      tenantMap.set(tenant.TenantId, {
        TenantId: tenant.TenantId,
        TenantName: tenant.TenantName || tenant.TenantId,
        UserRoles: []
      });
    }
    tenantMap.get(tenant.TenantId).UserRoles.push(tenant.RoleId);
  });

  const userTenants = Array.from(tenantMap.values());
  
  // Use the first tenant as the primary tenant for backward compatibility
  const userTenantId = userTenants[0].TenantId;
  const userTenantName = userTenants[0].TenantName;



  // Log access
  await normalizedLogging.logMessagingOperations({
    userEmail: session.user.email,
    tenantId: userTenantId,
    activityType: 'access_subscriber_messaging',
    accessType: 'read',
    targetId: 'harbor-messaging-page',
    targetName: 'Harbor Messaging Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { tenantId: userTenantId, tenantName: userTenantName }
  });

  // Get recent messages for the user within their tenant
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
    LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
    LEFT JOIN Subscribers s ON m.SenderEmail = s.Email AND s.Active = TRUE
    LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
    LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
    AND m.IsDeleted = FALSE
    AND m.MessageType = 'direct'
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
    LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
    LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
    LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
    WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
    AND m.IsDeleted = FALSE
    AND m.MessageType = 'direct'
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
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
      LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
      LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
      WHERE (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
      AND m.IsDeleted = FALSE
      AND m.MessageType = 'direct'
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

  // Get available recipients across all user's tenants (all roles)
  const recipientsQuery = `
    SELECT 
      tu.Email as Email,
      s.Name as Name,
      tu.TenantId as TenantId,
      t.Name as TenantName,
      tu.RoleId as RoleId,
      FALSE as IsOnline,
      CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
      ub.BlockerEmail
    FROM TenantUsers tu
    LEFT JOIN Subscribers s ON tu.Email = s.Email AND s.Active = TRUE
    LEFT JOIN Tenants t ON tu.TenantId = t.Id
    LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
    WHERE tu.TenantId IN (${userTenants.map(() => '?').join(',')})
    AND s.Active = TRUE AND s.Banned = FALSE
    AND tu.Email != ?
    
    UNION ALL
    
    SELECT 
      ur.Email as Email,
      s.Name as Name,
      ur.TenantId as TenantId,
      t.Name as TenantName,
      ur.RoleId as RoleId,
      FALSE as IsOnline,
      CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
      ub.BlockerEmail
    FROM UserRoles ur
    LEFT JOIN Subscribers s ON ur.Email = s.Email AND s.Active = TRUE
    LEFT JOIN Tenants t ON ur.TenantId = t.Id
    LEFT JOIN UserBlocks ub ON ur.Email = ub.BlockedEmail AND ur.TenantId = ur.TenantId AND ub.IsActive = TRUE
    WHERE ur.TenantId IN (${userTenants.map(() => '?').join(',')})
    AND s.Active = TRUE AND s.Banned = FALSE
    AND ur.Email != ?
    AND ur.RoleId != 'user'  -- Avoid duplicate 'user' roles from UserRoles table
    
    ORDER BY TenantId, Name, Email
  `;

  const recipientsResult = await db.prepare(recipientsQuery)
    .bind(...userTenants.map(t => t.TenantId), session.user.email, ...userTenants.map(t => t.TenantId), session.user.email)
    .all() as D1Result<any>;
  
  const recipients = recipientsResult.results || [];

  // Generate roles from recipients data instead of separate query
  const roles = recipients.reduce((acc, recipient) => {
    const existingRole = acc.find((r: { TenantId: string; RoleId: string; UserCount: number }) => r.TenantId === recipient.TenantId && r.RoleId === recipient.RoleId);
    if (existingRole) {
      existingRole.UserCount++;
    } else {
      acc.push({
        TenantId: recipient.TenantId,
        RoleId: recipient.RoleId,
        UserCount: 1
      });
    }
    return acc;
  }, [] as { TenantId: string; RoleId: string; UserCount: number }[]);
  
  console.log('Messaging page - Roles generated from recipients:', roles);

  // Calculate the actual available recipient count (excluding blocked users)
  const availableRecipientsCount = recipients.filter(r => !r.IsBlocked).length;

  const systemSettings = {
    messagingEnabled: settings.messaging_enabled === 'true',
    rateLimitSeconds: Number(settings.messaging_rate_limit) || 60,
    maxRecipients: availableRecipientsCount, // Use actual count instead of system limit
    recallWindowSeconds: Number(settings.messaging_recall_window) || 300,
    messageExpiryDays: Number(settings.messaging_message_expiry) || 30,
  };

  return (
    <SubscriberMessagingInterface 
      userEmail={session.user.email}
      userName={session.user.name || session.user.email}
      userTenantId={userTenantId}
      userTenantName={userTenantName}
      userTenants={userTenants}
      recentMessages={recentMessages}
      userStats={userStats}
      recipients={recipients}
      roles={roles}
      systemSettings={systemSettings}
      lang={lang}
    />
  );
}
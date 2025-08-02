import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor, hasPermission, type ResourceType } from './access';
import { SystemLogs } from './system-logs';
import type { RateLimitInfo, SystemSetting } from '@/types/messaging';

/**
 * Check if messaging system is enabled
 */
export async function isMessagingEnabled(): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const setting = await db.prepare(`
    SELECT Value FROM SystemSettings WHERE Key = 'messaging_enabled'
  `).first() as SystemSetting | null;
  
  return setting?.Value === 'true';
}

/**
 * Check rate limiting for a user
 */
export async function checkRateLimit(senderEmail: string): Promise<RateLimitInfo> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if messaging is enabled
  const messagingEnabled = await isMessagingEnabled();
  if (!messagingEnabled) {
    return { allowed: false, waitSeconds: 0, messageCount: 0, resetAt: '' };
  }
  
  // Get rate limit setting
  const rateLimitSetting = await db.prepare(`
    SELECT Value FROM SystemSettings WHERE Key = 'messaging_rate_limit'
  `).first() as SystemSetting | null;
  
  const limitSeconds = parseInt(rateLimitSetting?.Value || '60');
  
  // Check user's current rate limit
  const userLimit = await db.prepare(`
    SELECT LastMessageAt, MessageCount, ResetAt 
    FROM MessageRateLimits 
    WHERE SenderEmail = ? AND ResetAt > datetime('now')
  `).bind(senderEmail).first();
  
  if (!userLimit) {
    // First message or reset period passed
    const now = new Date().toISOString();
    const resetAt = new Date(Date.now() + limitSeconds * 1000).toISOString();
    await db.prepare(`
      INSERT OR REPLACE INTO MessageRateLimits 
      (SenderEmail, LastMessageAt, MessageCount, ResetAt) 
      VALUES (?, ?, 1, ?)
    `).bind(senderEmail, now, resetAt).run();
    
    return { 
      allowed: true, 
      waitSeconds: 0, 
      messageCount: 1, 
      resetAt 
    };
  }
  
  // Parse the LastMessageAt timestamp properly
  // SQLite datetime format: "2025-07-16 03:50:37"
  // Convert to ISO format for proper parsing
  const lastMessageAtStr = userLimit.LastMessageAt as string;
  let lastMessageAt: Date;
  
  if (lastMessageAtStr.includes('T')) {
    // Already in ISO format
    lastMessageAt = new Date(lastMessageAtStr);
  } else {
    // SQLite datetime format, convert to ISO
    const isoStr = lastMessageAtStr.replace(' ', 'T') + '.000Z';
    lastMessageAt = new Date(isoStr);
  }
  
  const timeSinceLast = Math.floor((Date.now() - lastMessageAt.getTime()) / 1000);
  const waitSeconds = Math.max(0, limitSeconds - timeSinceLast);
  
  return { 
    allowed: waitSeconds === 0, 
    waitSeconds, 
    messageCount: userLimit.MessageCount as number, 
    resetAt: userLimit.ResetAt as string 
  };
}



/**
 * Update rate limit after sending message
 */
export async function updateRateLimit(senderEmail: string): Promise<void> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE MessageRateLimits 
    SET LastMessageAt = ?, MessageCount = MessageCount + 1
    WHERE SenderEmail = ?
  `).bind(now, senderEmail).run();
}

/**
 * Check if user is blocked by recipient
 */
export async function isUserBlocked(senderEmail: string, recipientEmail: string, tenantId: string): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const block = await db.prepare(`
    SELECT 1 FROM UserBlocks 
    WHERE BlockerEmail = ? AND BlockedEmail = ? AND TenantId = ? AND IsActive = TRUE
  `).bind(recipientEmail, senderEmail, tenantId).first();
  
  return !!block;
}

/**
 * Check if user can send message to recipients
 */
export async function canSendMessage(
  senderEmail: string, 
  tenantId: string, 
  messageType: 'direct' | 'broadcast' | 'announcement',
  recipients: string[]
): Promise<{ allowed: boolean; blockedRecipients: string[]; error?: string }> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if messaging is enabled
  const messagingEnabled = await isMessagingEnabled();
  if (!messagingEnabled) {
    return { allowed: false, blockedRecipients: [], error: 'Messaging system is disabled' };
  }
  
  // Check if user is system admin
  const isAdmin = await isSystemAdmin(senderEmail, db);
  if (isAdmin) {
    return { allowed: true, blockedRecipients: [] };
  }
  
  // Check if user is tenant admin
  const isTenantAdmin = await isTenantAdminFor(senderEmail, tenantId);
  
  // Check permissions based on message type
  if (messageType === 'broadcast' || messageType === 'announcement') {
    if (!isTenantAdmin) {
      return { allowed: false, blockedRecipients: [], error: 'Only tenant admins can send broadcast messages' };
    }
  } else if (messageType === 'direct') {
    // Check if user has permission to send messages
    const hasSendPermission = await hasPermission(senderEmail, tenantId, 'message' as ResourceType, 'send');
    if (!hasSendPermission) {
      return { allowed: false, blockedRecipients: [], error: 'You do not have permission to send messages' };
    }
  }
  
  // Check if recipients are in the same tenant
  const validRecipients = await db.prepare(`
    SELECT Email FROM TenantUsers WHERE Email IN (${recipients.map(() => '?').join(',')}) AND TenantId = ?
  `).bind(...recipients, tenantId).all();
  
  const validEmails = validRecipients.results?.map(r => r.Email) || [];
  const invalidRecipients = recipients.filter(r => !validEmails.includes(r));
  
  if (invalidRecipients.length > 0) {
    return { 
      allowed: false, 
      blockedRecipients: [], 
      error: `Invalid recipients: ${invalidRecipients.join(', ')}` 
    };
  }
  
  // Check for blocked recipients
  const blockedRecipients: string[] = [];
  for (const recipient of recipients) {
    if (await isUserBlocked(senderEmail, recipient, tenantId)) {
      blockedRecipients.push(recipient);
    }
  }
  
  return { allowed: true, blockedRecipients };
}

/**
 * Get system settings
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const settings = await db.prepare(`
    SELECT Key, Value FROM SystemSettings
  `).all() as { results: SystemSetting[] };
  
  const settingsMap: Record<string, string> = {};
  settings.results?.forEach(setting => {
    settingsMap[setting.Key] = setting.Value;
  });
  
  return settingsMap;
}

/**
 * Update system setting
 */
export async function updateSystemSetting(key: string, value: string, updatedBy: string): Promise<void> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  await db.prepare(`
    UPDATE SystemSettings 
    SET Value = ?, UpdatedAt = datetime('now'), UpdatedBy = ?
    WHERE Key = ?
  `).bind(value, updatedBy, key).run();
}

/**
 * Log messaging activity
 */
export async function logMessagingActivity(
  activityType: string,
  userEmail: string,
  tenantId: string,
  targetId: string,
  targetName: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);
  
  await systemLogs.createLog({
    logType: 'MESSAGING',
    timestamp: new Date().toISOString(),
    userEmail,
    tenantId,
    activityType,
    targetId,
    targetName,
    metadata
  });
}

/**
 * Get user's accessible tenants for messaging
 */
export async function getUserMessagingTenants(userEmail: string): Promise<string[]> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // System admins can message across all tenants
  const isAdmin = await isSystemAdmin(userEmail, db);
  if (isAdmin) {
    const tenants = await db.prepare(`
      SELECT Id FROM Tenants
    `).all() as { results: { Id: string }[] };
    return tenants.results?.map(t => t.Id) || [];
  }
  
  // Regular users can only message within their tenants
  const userTenants = await db.prepare(`
    SELECT TenantId FROM TenantUsers WHERE Email = ?
  `).bind(userEmail).all() as { results: { TenantId: string }[] };
  
  return userTenants.results?.map(t => t.TenantId) || [];
}

/**
 * Check if message can be recalled
 */
export async function canRecallMessage(messageId: number, senderEmail: string): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Get message details
  const message = await db.prepare(`
    SELECT SenderEmail, CreatedAt, IsRecalled FROM Messages WHERE Id = ?
  `).bind(messageId).first() as { SenderEmail: string; CreatedAt: string; IsRecalled: boolean } | undefined;
  
  if (!message || message.SenderEmail !== senderEmail || message.IsRecalled) {
    return false;
  }
  
  // Get recall window setting
  const recallWindowSetting = await db.prepare(`
    SELECT Value FROM SystemSettings WHERE Key = 'messaging_recall_window'
  `).first() as SystemSetting | null;
  
  const recallWindowSeconds = parseInt(recallWindowSetting?.Value || '3600');
  const messageAge = Math.floor((Date.now() - new Date(message.CreatedAt).getTime()) / 1000);
  
  return messageAge <= recallWindowSeconds;
} 
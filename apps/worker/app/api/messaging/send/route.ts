import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { checkRateLimit, getSystemSettings, updateRateLimit } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import type { D1Result } from '@cloudflare/workers-types';

export const runtime = 'edge';

interface SendMessageRequest {
  subject: string;
  body: string;
  recipients: string[];
  messageType: string;
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Get system settings
    const settings = await getSystemSettings();
    if (settings.messaging_enabled !== 'true') {
      return new Response(JSON.stringify({ error: 'Messaging system is disabled' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body: SendMessageRequest = await request.json();
    
    // Validate request
    if (!body.subject?.trim() || !body.body?.trim() || !body.recipients?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxRecipients = Number(settings.messaging_max_recipients) || 10;
    if (body.recipients.length > maxRecipients) {
      return new Response(JSON.stringify({ 
        error: `Maximum ${maxRecipients} recipients allowed` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(access.email);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: `Rate limit exceeded. Please wait ${rateLimitResult.waitSeconds} seconds.` 
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate recipients
    const recipientsQuery = `
      SELECT tu.Email, s.Name, tu.TenantId
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      WHERE tu.Email IN (${body.recipients.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
    `;

    const recipientsResult = await db.prepare(recipientsQuery)
      .bind(...body.recipients)
      .all() as D1Result<any>;

    const validRecipients = recipientsResult.results || [];
    
    if (validRecipients.length !== body.recipients.length) {
      return new Response(JSON.stringify({ 
        error: 'Some recipients are invalid or not accessible' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert message
    const insertMessageQuery = `
      INSERT INTO Messages (Subject, Body, SenderEmail, TenantId, MessageType, Priority, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const tenantId = validRecipients[0]?.TenantId || 'system';
    const priority = body.messageType === 'announcement' ? 'high' : 'normal';
    const createdAt = new Date().toISOString();

    const messageResult = await db.prepare(insertMessageQuery)
      .bind(
        body.subject.trim(),
        body.body.trim(),
        access.email,
        tenantId,
        body.messageType,
        priority,
        createdAt
      )
      .run();

    const messageId = messageResult.meta.last_row_id;

    // Insert recipients
    const insertRecipientQuery = `
      INSERT INTO MessageRecipients (MessageId, RecipientEmail, IsRead)
      VALUES (?, ?, FALSE)
    `;

    const recipientPromises = validRecipients.map(recipient =>
      db.prepare(insertRecipientQuery)
        .bind(messageId, recipient.Email)
        .run()
    );

    await Promise.all(recipientPromises);

    // Update rate limit after successful message send
    await updateRateLimit(access.email);

    // Log the message
    await systemLogs.logMessagingOperation({
      userEmail: access.email,
      activityType: 'SEND_MESSAGE',
      targetId: messageId.toString(),
      targetName: body.subject,
      tenantId: tenantId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        messageId,
        subject: body.subject,
        messageType: body.messageType,
        recipientCount: validRecipients.length,
        recipients: validRecipients.map(r => r.Email)
      }
    });

    // Return the created message
    const createdMessage = {
      Id: messageId,
      Subject: body.subject,
      Body: body.body,
      SenderEmail: access.email,
      SenderName: access.email, // We don't have name from checkAccess, so use email
      CreatedAt: createdAt,
      MessageType: body.messageType,
      RecipientCount: validRecipients.length
    };

    return new Response(JSON.stringify(createdMessage), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 
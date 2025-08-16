import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { logMessagingActivity } from '@/lib/messaging';
import type { D1Result } from '@cloudflare/workers-types';

interface SendMessageRequest {
  subject: string;
  body: string;
  recipients: string[];
  messageType: string;
  priority?: string;
  tenantId?: string;
}

// POST /api/dashboard/messaging/send - Send message from dashboard
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body: SendMessageRequest = await request.json();
    const { subject, body: messageBody, recipients, messageType, priority = 'normal', tenantId } = body;

    // Validate required fields
    if (!subject?.trim() || !messageBody?.trim() || !recipients?.length) {
      return NextResponse.json({ 
        error: 'Missing required fields: subject, body, recipients' 
      }, { status: 400 });
    }

    // Validate tenant access
    let targetTenantId = tenantId;
    if (!targetTenantId) {
      if (accessibleTenants.length === 1) {
        targetTenantId = accessibleTenants[0];
      } else if (accessibleTenants.length > 1) {
        return NextResponse.json({ 
          error: 'Tenant ID required when user has access to multiple tenants' 
        }, { status: 400 });
      } else {
        return NextResponse.json({ 
          error: 'No accessible tenants found' 
        }, { status: 400 });
      }
    }

    if (!isAdmin && !accessibleTenants.includes(targetTenantId)) {
      return NextResponse.json({ 
        error: 'Access denied to specified tenant' 
      }, { status: 403 });
    }

    // Validate recipients exist in the tenant
    const recipientValidation = await db.prepare(`
      SELECT Email FROM TenantUsers 
      WHERE TenantId = ? AND Email IN (${recipients.map(() => '?').join(',')})
    `).bind(targetTenantId, ...recipients).all() as D1Result<any>;

    // Also check UserRoles table for subscribers
    const subscriberValidation = await db.prepare(`
      SELECT Email FROM UserRoles 
      WHERE TenantId = ? AND Email IN (${recipients.map(() => '?').join(',')}) AND RoleId = 'subscriber'
    `).bind(targetTenantId, ...recipients).all() as D1Result<any>;

    // Check if any recipients are system admins (who have global access)
    const adminValidation = await db.prepare(`
      SELECT Email FROM Credentials 
      WHERE Email IN (${recipients.map(() => '?').join(',')}) AND Role IN ('admin', 'tenant')
    `).bind(...recipients).all() as D1Result<any>;

    // Combine all results (tenant users, subscribers, and system admins)
    const tenantUsers = recipientValidation.results.map(r => r.Email) as string[];
    const subscribers = subscriberValidation.results.map(r => r.Email) as string[];
    const systemAdmins = adminValidation.results.map(r => r.Email) as string[];
    const validRecipients = [...new Set([...tenantUsers, ...subscribers, ...systemAdmins])];

    if (validRecipients.length !== recipients.length) {
      const invalidRecipients = recipients.filter(r => !validRecipients.includes(r));
      return NextResponse.json({ 
        error: `Invalid recipients: ${invalidRecipients.join(', ')}` 
      }, { status: 400 });
    }

    // Check rate limiting
    const rateLimitCheck = await db.prepare(`
      SELECT CreatedAt FROM Messages 
      WHERE SenderEmail = ? AND CreatedAt > datetime('now', '-1 minute')
      ORDER BY CreatedAt DESC
      LIMIT 1
    `).bind(session.user.email).first() as { CreatedAt: string } | undefined;

    if (rateLimitCheck) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please wait before sending another message.' 
      }, { status: 429 });
    }



    // Insert message into Messages table
    const messageResult = await db.prepare(`
      INSERT INTO Messages (Subject, Body, SenderEmail, SenderType, TenantId, MessageType, Priority, CreatedAt, HasAttachments, AttachmentCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), FALSE, 0)
    `).bind(subject.trim(), messageBody.trim(), session.user.email, isAdmin ? 'admin' : 'tenant', targetTenantId, messageType, priority).run();

    const messageId = messageResult.meta.last_row_id;

    // Insert recipients into MessageRecipients table
    for (const recipient of recipients) {
      await db.prepare(`
        INSERT INTO MessageRecipients (MessageId, RecipientEmail)
        VALUES (?, ?)
      `).bind(messageId, recipient).run();
    }

    // Log activity
    await logMessagingActivity(
      'SEND_MESSAGE_DASHBOARD',
      session.user.email,
      targetTenantId,
      messageId.toString(),
      `Sent ${messageType} message to ${recipients.length} recipients`
    );

    return NextResponse.json({
      success: true,
      messageId: messageId,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending message from dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

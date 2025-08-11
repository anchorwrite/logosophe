import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createMessageNewEventData } from '@/lib/messaging-events';
import { CreateMessageRequest, CreateAttachmentRequest, CreateLinkRequest } from '@/types/messaging';

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userEmail = session.user.email;
    const body: CreateMessageRequest = await request.json();
    
    const { subject, body: messageBody, recipients, tenantId, messageType = 'direct', priority = 'normal', attachments = [], links = [] } = body;
    
    // Validate required fields
    if (!subject || !messageBody || !recipients || recipients.length === 0 || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: subject, body, recipients, tenantId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this tenant
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, tenantId)) {
        hasAccess = true;
      } else {
        // Check if user is a member of this tenant
        const userTenant = await db.prepare(`
          SELECT 1 FROM TenantUsers 
          WHERE TenantId = ? AND Email = ?
        `).bind(tenantId, userEmail).first();
        
        if (userTenant) {
          hasAccess = true;
        } else {
          // Check if user has subscriber role in UserRoles table for this tenant
          const userRole = await db.prepare(`
            SELECT 1 FROM UserRoles 
            WHERE TenantId = ? AND Email = ? AND RoleId = 'subscriber'
          `).bind(tenantId, userEmail).first();
          
          hasAccess = !!userRole;
        }
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: User does not have access to this tenant' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate recipients exist in the tenant
    const recipientValidation = await db.prepare(`
      SELECT Email FROM TenantUsers 
      WHERE TenantId = ? AND Email IN (${recipients.map(() => '?').join(',')})
    `).bind(tenantId, ...recipients).all();

    // Also check UserRoles table for subscribers
    const subscriberValidation = await db.prepare(`
      SELECT Email FROM UserRoles 
      WHERE TenantId = ? AND Email IN (${recipients.map(() => '?').join(',')}) AND RoleId = 'subscriber'
    `).bind(tenantId, ...recipients).all();

    // Combine both results
    const tenantUsers = recipientValidation.results.map(r => r.Email) as string[];
    const subscribers = subscriberValidation.results.map(r => r.Email) as string[];
    const validRecipients = [...new Set([...tenantUsers, ...subscribers])];
    
    const invalidRecipients = recipients.filter(email => !validRecipients.includes(email));

    if (invalidRecipients.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Invalid recipients: ${invalidRecipients.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Start transaction
    const transaction = await db.batch([
      // Insert message
      db.prepare(`
        INSERT INTO Messages (Subject, Body, SenderEmail, TenantId, MessageType, Priority, HasAttachments, AttachmentCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(subject, messageBody, userEmail, tenantId, messageType, priority, attachments.length > 0, attachments.length),
      
      // Get the inserted message ID
      db.prepare('SELECT last_insert_rowid() as messageId')
    ]);

    const messageId = (transaction[1].results[0] as { messageId: number }).messageId;

    // Insert recipients
    const recipientInserts = validRecipients.map(email => 
      db.prepare(`
        INSERT INTO MessageRecipients (MessageId, RecipientEmail)
        VALUES (?, ?)
      `).bind(messageId, email)
    );

    // Insert attachments if any
    const attachmentInserts = [];
    for (const attachment of attachments) {
      if (attachment.attachmentType === 'media_library' && attachment.mediaId) {
        // Get media file info
        const mediaFile = await db.prepare(`
          SELECT FileName, FileSize, ContentType FROM MediaFiles WHERE Id = ?
        `).bind(attachment.mediaId).first();
        
        if (mediaFile) {
          attachmentInserts.push(
            db.prepare(`
              INSERT INTO MessageAttachments (MessageId, MediaId, AttachmentType, FileName, FileSize, ContentType)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(messageId, attachment.mediaId, attachment.attachmentType, mediaFile.FileName, mediaFile.FileSize, mediaFile.ContentType)
          );
        }
      }
      // Note: File uploads will be handled separately in the upload endpoint
    }

    // Insert links if any
    const linkInserts = [];
    for (const link of links) {
      try {
        const url = new URL(link.url);
        const domain = url.hostname;
        
        linkInserts.push(
          db.prepare(`
            INSERT INTO MessageLinks (MessageId, Url, Domain)
            VALUES (?, ?, ?)
          `).bind(messageId, link.url, domain)
        );
      } catch (error) {
        // Invalid URL, skip this link
        console.warn(`Invalid URL in message: ${link.url}`);
      }
    }

    // Execute all inserts
    const allInserts = [...recipientInserts, ...attachmentInserts, ...linkInserts];
    if (allInserts.length > 0) {
      await db.batch(allInserts);
    }

    // Broadcast SSE event for new message
    const eventData = createMessageNewEventData(
      messageId,
      tenantId,
      userEmail,
      validRecipients,
      subject,
      messageBody,
      attachments.length > 0,
      attachments.length
    );

    MessagingEventBroadcaster.broadcastMessageNew(tenantId, eventData);

    return new Response(JSON.stringify({
      success: true,
      data: {
        messageId,
        subject,
        body: messageBody,
        recipientEmails: validRecipients,
        tenantId,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        linksCount: links.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 
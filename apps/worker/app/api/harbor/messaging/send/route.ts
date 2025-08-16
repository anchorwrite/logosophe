import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor, hasPermission } from '@/lib/access';
import { isUserBlocked, isUserBlockedInTenant } from '@/lib/messaging';
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
    if (!subject || !recipients || recipients.length === 0 || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: subject, recipients, tenantId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Message must have either body, attachments, or links
    if (!messageBody.trim() && attachments.length === 0 && links.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message must contain body text, attachments, or links' 
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

    // Check if sender is blocked by anyone in this tenant (using updated blocking logic)
    const senderBlocked = await isUserBlockedInTenant(userEmail, tenantId);
    
    if (senderBlocked) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'You are blocked from sending messages in this tenant' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate message type permissions
    if (messageType === 'broadcast' || messageType === 'announcement') {
      // Only tenant admins can send broadcast/announcement messages
      const isTenantAdmin = await isTenantAdminFor(userEmail, tenantId);
      if (!isTenantAdmin) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Only tenant admins can send broadcast or announcement messages' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    // For 'direct' messages, no additional permission check needed since user already passed tenant access validation

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

    // Check if any recipients are system admins (who have global access)
    const adminValidation = await db.prepare(`
      SELECT Email FROM Credentials 
      WHERE Email IN (${recipients.map(() => '?').join(',')}) AND Role IN ('admin', 'tenant')
    `).bind(...recipients).all();

    // Check for blocked recipients (using updated blocking logic that respects system-wide blocks)
    const blockedRecipients: string[] = [];
    for (const recipient of recipients) {
      if (await isUserBlocked(userEmail, recipient, tenantId)) {
        blockedRecipients.push(recipient);
      }
    }
    
    if (blockedRecipients.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Cannot send message to blocked recipients: ${blockedRecipients.join(', ')}` 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Combine all results (tenant users, subscribers, and system admins)
    const tenantUsers = recipientValidation.results.map(r => r.Email) as string[];
    const subscribers = subscriberValidation.results.map(r => r.Email) as string[];
    const systemAdmins = adminValidation.results.map(r => r.Email) as string[];
    const validRecipients = [...new Set([...tenantUsers, ...subscribers, ...systemAdmins])];
    
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
      if (attachment.mediaId) {
        // Get media file info for both media_library and upload types
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
    }

    // Insert links if any
    console.log('Processing links:', links);
    const linkInserts = [];
    for (const link of links) {
      try {
        console.log('Processing link:', link);
        const url = new URL(link.url);
        const domain = url.hostname;
        console.log('Extracted domain:', domain);
        
        linkInserts.push(
          db.prepare(`
            INSERT INTO MessageLinks (MessageId, Url, Domain)
            VALUES (?, ?, ?)
          `).bind(messageId, link.url, domain)
        );
        console.log('Link insert prepared for:', link.url);
      } catch (error) {
        // Invalid URL, skip this link
        console.error('Error processing link:', link, error);
        console.warn(`Invalid URL in message: ${link.url}`);
      }
    }
    
    console.log('Total link inserts prepared:', linkInserts.length);

    // Execute all inserts
    const allInserts = [...recipientInserts, ...attachmentInserts, ...linkInserts];
    console.log('Executing batch insert with:', {
      recipientInserts: recipientInserts.length,
      attachmentInserts: attachmentInserts.length,
      linkInserts: linkInserts.length,
      total: allInserts.length
    });
    
    if (allInserts.length > 0) {
      await db.batch(allInserts);
      console.log('Batch insert completed successfully');
    } else {
      console.log('No inserts to execute');
    }

    // SSE events are now handled by the polling-based endpoint
    // No need to broadcast - clients will receive updates automatically
    console.log('Message sent successfully - SSE updates handled by polling endpoint');

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
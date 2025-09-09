import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor, hasPermission } from '@/lib/access';
import { isUserBlocked, isUserBlockedInTenant } from '@/lib/messaging';
import { CreateMessageRequest, CreateAttachmentRequest, CreateLinkRequest } from '@/types/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    
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
    
    // Debug: Log the received request body
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    const { 
      subject, 
      body: messageBody, 
      tenants, 
      roles, 
      individualRecipients,
      messageType = 'role_based', 
      priority = 'normal', 
      attachments = [], 
      links = [] 
    } = body;
    
    // Debug: Log the extracted values
    console.log('Extracted values:', {
      subject,
      messageBody,
      messageBodyType: typeof messageBody,
      messageBodyLength: messageBody?.length,
      messageBodyTrimmed: messageBody?.trim(),
      tenants,
      roles,
      individualRecipients,
      attachments,
      links
    });
    
    // Validate required fields
    if (!subject || !tenants || tenants.length === 0) {
      console.log('Validation failed: Missing required fields');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: subject, tenants' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate recipient selection
    if ((!roles || roles.length === 0) && (!individualRecipients || individualRecipients.length === 0)) {
      console.log('Validation failed: No recipients selected');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'At least one role or individual recipient must be selected' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Message must have either body, attachments, or links
    if (!messageBody.trim() && attachments.length === 0 && links.length === 0) {
      console.log('Validation failed: No message content');
      console.log('messageBody.trim():', messageBody?.trim());
      console.log('attachments.length:', attachments.length);
      console.log('links.length:', links.length);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message must contain body text, attachments, or links' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to all selected tenants
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for any of the selected tenants
      for (const tenantId of tenants) {
        if (await isTenantAdminFor(userEmail, tenantId)) {
          hasAccess = true;
          break;
        }
      }
      
      if (!hasAccess) {
        // Check if user is a member of all selected tenants
        for (const tenantId of tenants) {
          const userTenant = await db.prepare(`
            SELECT 1 FROM TenantUsers 
            WHERE TenantId = ? AND Email = ?
          `).bind(tenantId, userEmail).first();
          
          if (!userTenant) {
            // Check if user has subscriber role in UserRoles table for this tenant
            const userRole = await db.prepare(`
              SELECT 1 FROM UserRoles 
              WHERE TenantId = ? AND Email = ? AND RoleId = 'subscriber'
            `).bind(tenantId, userEmail).first();
            
            if (!userRole) {
              return new Response(JSON.stringify({ 
                success: false, 
                error: `Forbidden: User does not have access to tenant ${tenantId}` 
              }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
        }
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: User does not have access to selected tenants' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if sender is blocked by anyone in any of the selected tenants
    for (const tenantId of tenants) {
      const senderBlocked = await isUserBlockedInTenant(userEmail, tenantId);
      if (senderBlocked) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `You are blocked from sending messages in tenant ${tenantId}` 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Expand role targets to individual recipients
    let allRecipients = new Set<string>();
    
    // Add role-based recipients
    if (roles && roles.length > 0) {
      // Check TenantUsers table for role-based recipients
      const roleRecipients = await db.prepare(`
        SELECT Email FROM TenantUsers 
        WHERE TenantId IN (${tenants.map(() => '?').join(',')})
        AND RoleId IN (${roles.map(() => '?').join(',')})
        AND RoleId != 'user'
        AND Email != ?
      `).bind(...tenants, ...roles, userEmail).all();
      
      roleRecipients.results.forEach((r: any) => allRecipients.add(r.Email as string));
      
      // Also check UserRoles table for role-based recipients (e.g., subscribers with specific roles)
      const userRoleRecipients = await db.prepare(`
        SELECT Email FROM UserRoles 
        WHERE TenantId IN (${tenants.map(() => '?').join(',')})
        AND RoleId IN (${roles.map(() => '?').join(',')})
        AND Email != ?
      `).bind(...tenants, ...roles, userEmail).all();
      
      userRoleRecipients.results.forEach((r: any) => allRecipients.add(r.Email as string));
      
      // Debug: Log what we found
      console.log('Role-based recipients found:', {
        fromTenantUsers: roleRecipients.results.map((r: any) => r.Email),
        fromUserRoles: userRoleRecipients.results.map((r: any) => r.Email),
        totalUnique: allRecipients.size
      });
    }
    
    // Add individual recipients
    if (individualRecipients && individualRecipients.length > 0) {
      individualRecipients.forEach((email: string) => allRecipients.add(email));
    }
    
    // Convert to array and validate
    const finalRecipients = Array.from(allRecipients);
    
    if (finalRecipients.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No valid recipients found for the selected roles and individual recipients' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that all individual recipients exist and are accessible
    if (individualRecipients && individualRecipients.length > 0) {
      const recipientValidation = await db.prepare(`
        SELECT Email FROM TenantUsers 
        WHERE TenantId IN (${tenants.map(() => '?').join(',')})
        AND Email IN (${individualRecipients.map(() => '?').join(',')})
        AND RoleId != 'user'
      `).bind(...tenants, ...individualRecipients).all();

      // Also check UserRoles table for any role (not just subscribers)
      const subscriberValidation = await db.prepare(`
        SELECT Email FROM UserRoles 
        WHERE TenantId IN (${tenants.map(() => '?').join(',')})
        AND Email IN (${individualRecipients.map(() => '?').join(',')})
      `).bind(...tenants, ...individualRecipients).all();

      // Check if any recipients are system admins (who have global access)
      const adminValidation = await db.prepare(`
        SELECT Email FROM Credentials 
        WHERE Email IN (${individualRecipients.map(() => '?').join(',')}) 
        AND Role IN ('admin', 'tenant')
      `).bind(...individualRecipients).all();

      const tenantUsers = recipientValidation.results.map((r: any) => r.Email) as string[];
      const subscribers = subscriberValidation.results.map((r: any) => r.Email) as string[];
      const systemAdmins = adminValidation.results.map((r: any) => r.Email) as string[];
      const validIndividualRecipients = [...new Set([...tenantUsers, ...subscribers, ...systemAdmins])];
      
      const invalidIndividualRecipients = individualRecipients.filter((email: string) => !validIndividualRecipients.includes(email));
      
      if (invalidIndividualRecipients.length > 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Invalid individual recipients: ${invalidIndividualRecipients.join(', ')}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Check for blocked recipients
    const blockedRecipients: string[] = [];
    for (const recipient of finalRecipients) {
      if (await isUserBlocked(userEmail, recipient, tenants[0])) { // Use first tenant for blocking check
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

    // Use the first tenant as the primary tenant for the message
    const primaryTenantId = tenants[0];

    // Start transaction
    const transaction = await db.batch([
      // Insert message
      db.prepare(`
        INSERT INTO Messages (Subject, Body, SenderEmail, TenantId, MessageType, Priority, HasAttachments, AttachmentCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(subject, messageBody, userEmail, primaryTenantId, messageType, priority, attachments.length > 0, attachments.length),
      
      // Get the inserted message ID
      db.prepare('SELECT last_insert_rowid() as messageId')
    ]);

    const messageId = (transaction[1].results[0] as { messageId: number }).messageId;

    // Insert recipients
    const recipientInserts = finalRecipients.map(email => 
      db.prepare(`
        INSERT INTO MessageRecipients (MessageId, RecipientEmail)
        VALUES (?, ?)
      `).bind(messageId, email)
    );

    // Insert attachments if any
    const attachmentInserts = [];
    for (const attachment of attachments) {
      if (attachment.r2Key || attachment.attachmentType === 'upload') {
        // Handle uploaded files - use data from attachment object
        attachmentInserts.push(
          db.prepare(`
            INSERT INTO MessageAttachments (MessageId, MediaId, AttachmentType, FileName, FileSize, ContentType, R2Key, UploadDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            messageId, 
            null, // No MediaId for uploaded files
            attachment.attachmentType || 'upload', 
            attachment.fileName, 
            attachment.fileSize, 
            attachment.contentType, 
            attachment.r2Key,
            new Date().toISOString()
          )
        );
      } else if (attachment.mediaId && attachment.attachmentType === 'media_library') {
        // Handle media library files - get info from MediaFiles table
        const mediaFile = await db.prepare(`
          SELECT Id, FileName, FileSize, ContentType, R2Key
          FROM MediaFiles 
          WHERE Id = ? AND IsDeleted = FALSE
        `).bind(attachment.mediaId).first() as any;

        if (mediaFile) {
          attachmentInserts.push(
            db.prepare(`
              INSERT INTO MessageAttachments (MessageId, MediaId, AttachmentType, FileName, FileSize, ContentType, R2Key)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(messageId, attachment.mediaId, attachment.attachmentType, mediaFile.FileName, mediaFile.FileSize, mediaFile.ContentType, mediaFile.R2Key)
          );
        }
      }
    }

    // Insert links if any
    const linkInserts = [];
    for (const link of links) {
      if (link.url) {
        linkInserts.push(
          db.prepare(`
            INSERT INTO MessageLinks (MessageId, Url, Title, ThumbnailUrl, Domain)
            VALUES (?, ?, ?, ?, ?)
          `).bind(messageId, link.url, link.title || '', link.thumbnailUrl || '', link.domain || '')
        );
      }
    }

    // Execute all inserts
    const allInserts = [...recipientInserts, ...attachmentInserts, ...linkInserts];
    if (allInserts.length > 0) {
      await db.batch(allInserts);
    }

    // Log the message creation
    await normalizedLogging.logMessagingOperations({
      userEmail: userEmail,
      tenantId: primaryTenantId,
      activityType: 'send_role_based_message',
      accessType: 'write',
      targetId: messageId.toString(),
      targetName: `Role-based message: ${subject}`,
      ipAddress,
      userAgent,
      metadata: {
        messageType: 'role_based',
        targetTenants: tenants,
        targetRoles: roles || [],
        individualRecipients: individualRecipients || [],
        totalRecipients: finalRecipients.length,
        hasAttachments: attachments.length > 0,
        hasLinks: links.length > 0,
        priority: priority
      }
    });

    return new Response(JSON.stringify({
      success: true,
      messageId: messageId,
      recipients: finalRecipients,
      message: 'Message sent successfully'
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
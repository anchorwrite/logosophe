import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import type { D1Result } from '@cloudflare/workers-types';

interface SendMessageRequest {
  subject: string;
  body: string;
  recipients?: string[];
  messageType: string;
  priority?: string;
  tenantId?: string;
  // New role-based messaging fields
  tenants?: string[];
  roles?: string[];
  individualRecipients?: string[];
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
    const { 
      subject, 
      body: messageBody, 
      recipients, 
      messageType, 
      priority = 'normal', 
      tenantId,
      tenants,
      roles,
      individualRecipients
    } = body;

    // Validate required fields
    if (!subject?.trim() || !messageBody?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: subject, body' 
      }, { status: 400 });
    }

    // Determine if this is role-based messaging or legacy messaging
    const isRoleBasedMessaging = tenants !== undefined || roles !== undefined || individualRecipients !== undefined;
    
    let allRecipients: string[] = [];
    let targetTenantIds: string[] = [];

    if (isRoleBasedMessaging) {
      // Role-based messaging
      if ((!tenants || tenants.length === 0) && (!roles || roles.length === 0) && (!individualRecipients || individualRecipients.length === 0)) {
        return NextResponse.json({ 
          error: 'Please select at least one tenant, role, or individual recipient' 
        }, { status: 400 });
      }

      // Determine target tenants
      if (tenants && tenants.length > 0) {
        targetTenantIds = tenants;
      } else if (roles && roles.length > 0) {
        // Get unique tenants from selected roles
        const roleTenantsQuery = `
          SELECT DISTINCT TenantId FROM (
            SELECT TenantId FROM TenantUsers WHERE RoleId IN (${roles.map(() => '?').join(',')})
            UNION
            SELECT TenantId FROM UserRoles WHERE RoleId IN (${roles.map(() => '?').join(',')})
          )
        `;
        const roleTenantsResult = await db.prepare(roleTenantsQuery)
          .bind(...roles, ...roles)
          .all() as D1Result<{ TenantId: string }>;
        targetTenantIds = roleTenantsResult.results.map(r => r.TenantId);
      } else if (individualRecipients && individualRecipients.length > 0) {
        // Get unique tenants from individual recipients
        const recipientTenantsQuery = `
          SELECT DISTINCT TenantId FROM (
            SELECT TenantId FROM TenantUsers WHERE Email IN (${individualRecipients.map(() => '?').join(',')})
            UNION
            SELECT TenantId FROM UserRoles WHERE Email IN (${individualRecipients.map(() => '?').join(',')})
          )
        `;
        const recipientTenantsResult = await db.prepare(recipientTenantsQuery)
          .bind(...individualRecipients, ...individualRecipients)
          .all() as D1Result<{ TenantId: string }>;
        targetTenantIds = recipientTenantsResult.results.map(r => r.TenantId);
      }

      // Validate tenant access
      if (!isAdmin) {
        const unauthorizedTenants = targetTenantIds.filter(t => !accessibleTenants.includes(t));
        if (unauthorizedTenants.length > 0) {
          return NextResponse.json({ 
            error: `Access denied to tenants: ${unauthorizedTenants.join(', ')}` 
          }, { status: 403 });
        }
      }

      // Build recipient list based on selections
      const recipientSet = new Set<string>();

      // Add recipients from selected tenants
      if (tenants && tenants.length > 0) {
        const tenantRecipientsQuery = `
          SELECT DISTINCT Email FROM (
            SELECT tu.Email FROM TenantUsers tu
            LEFT JOIN Subscribers s ON tu.Email = s.Email
            WHERE tu.TenantId IN (${tenants.map(() => '?').join(',')})
            AND s.Active = TRUE AND s.Banned = FALSE
            AND tu.Email != ?
            
            UNION
            
            SELECT ur.Email FROM UserRoles ur
            LEFT JOIN Subscribers s ON ur.Email = s.Email
            WHERE ur.TenantId IN (${tenants.map(() => '?').join(',')})
            AND ur.RoleId IN ('subscriber', 'reviewer', 'author', 'editor')
            AND s.Active = TRUE AND s.Banned = FALSE
            AND ur.Email != ?
          )
        `;
        const tenantRecipientsResult = await db.prepare(tenantRecipientsQuery)
          .bind(...tenants, session.user.email, ...tenants, session.user.email)
          .all() as D1Result<{ Email: string }>;
        
        tenantRecipientsResult.results.forEach(r => recipientSet.add(r.Email));
      }

      // Add recipients from selected roles
      if (roles && roles.length > 0) {
        const roleRecipientsQuery = `
          SELECT DISTINCT Email FROM (
            SELECT tu.Email FROM TenantUsers tu
            LEFT JOIN Subscribers s ON tu.Email = s.Email
            WHERE tu.RoleId IN (${roles.map(() => '?').join(',')})
            AND s.Active = TRUE AND s.Banned = FALSE
            AND tu.Email != ?
            
            UNION
            
            SELECT ur.Email FROM UserRoles ur
            LEFT JOIN Subscribers s ON ur.Email = s.Email
            WHERE ur.RoleId IN (${roles.map(() => '?').join(',')})
            AND s.Active = TRUE AND s.Banned = FALSE
            AND ur.Email != ?
          )
        `;
        const roleRecipientsResult = await db.prepare(roleRecipientsQuery)
          .bind(...roles, session.user.email, ...roles, session.user.email)
          .all() as D1Result<{ Email: string }>;
        
        roleRecipientsResult.results.forEach(r => recipientSet.add(r.Email));
      }

      // Add individual recipients
      if (individualRecipients && individualRecipients.length > 0) {
        individualRecipients.forEach(email => recipientSet.add(email));
      }

      allRecipients = Array.from(recipientSet);

      // Validate that we have recipients
      if (allRecipients.length === 0) {
        return NextResponse.json({ 
          error: 'No valid recipients found for the selected criteria' 
        }, { status: 400 });
      }

    } else {
      // Legacy messaging format
      if (!recipients?.length) {
        return NextResponse.json({ 
          error: 'Missing required fields: recipients' 
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

      targetTenantIds = [targetTenantId];

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

      allRecipients = recipients;
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

    // For role-based messaging, we need to send to multiple tenants
    if (isRoleBasedMessaging && targetTenantIds.length > 1) {
      // Send message to each tenant separately
      const results = [];
      const errors = [];

      for (const targetTenantId of targetTenantIds) {
        try {
          // Get recipients for this specific tenant
          const tenantRecipients = [];
          for (const email of allRecipients) {
            const tenantCheck = await db.prepare(`
              SELECT 1 FROM (
                SELECT Email FROM TenantUsers WHERE TenantId = ? AND Email = ?
                UNION
                SELECT Email FROM UserRoles WHERE TenantId = ? AND Email = ?
              )
            `).bind(targetTenantId, email, targetTenantId, email).first();
            if (tenantCheck) {
              tenantRecipients.push(email);
            }
          }

          if (tenantRecipients.length > 0) {
            // Insert message for this tenant
            const messageResult = await db.prepare(`
              INSERT INTO Messages (Subject, Body, SenderEmail, SenderType, TenantId, MessageType, Priority, CreatedAt, HasAttachments, AttachmentCount)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), FALSE, 0)
            `).bind(subject.trim(), messageBody.trim(), session.user.email, isAdmin ? 'admin' : 'tenant', targetTenantId, messageType, priority).run();

            const messageId = messageResult.meta.last_row_id;

            // Insert recipients for this tenant
            for (const recipient of tenantRecipients) {
              await db.prepare(`
                INSERT INTO MessageRecipients (MessageId, RecipientEmail)
                VALUES (?, ?)
              `).bind(messageId, recipient).run();
            }

            results.push({ tenantId: targetTenantId, messageId, recipientCount: tenantRecipients.length });
          }
        } catch (error) {
          console.error(`Error sending message to tenant ${targetTenantId}:`, error);
          errors.push({ tenantId: targetTenantId, error: 'Failed to send message' });
        }
      }

      // Log activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: 'multi-tenant',
        activityType: 'SEND_MESSAGE_DASHBOARD_ROLE_BASED',
        accessType: 'write',
        targetId: 'multi-tenant',
        targetName: `Sent ${messageType} message to ${allRecipients.length} recipients across ${targetTenantIds.length} tenants`,
        ipAddress,
        userAgent,
        metadata: { 
          messageType, 
          priority, 
          recipientCount: allRecipients.length,
          tenantCount: targetTenantIds.length,
          isRoleBased: true
        }
      });

      return NextResponse.json({
        success: true,
        results,
        errors,
        message: `Message sent to ${results.length} tenant(s) successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`
      });

    } else {
      // Single tenant or legacy messaging
      const targetTenantId = targetTenantIds[0];

      // Insert message into Messages table
      const messageResult = await db.prepare(`
        INSERT INTO Messages (Subject, Body, SenderEmail, SenderType, TenantId, MessageType, Priority, CreatedAt, HasAttachments, AttachmentCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), FALSE, 0)
      `).bind(subject.trim(), messageBody.trim(), session.user.email, isAdmin ? 'admin' : 'tenant', targetTenantId, messageType, priority).run();

      const messageId = messageResult.meta.last_row_id;

      // Insert recipients into MessageRecipients table
      for (const recipient of allRecipients) {
        await db.prepare(`
          INSERT INTO MessageRecipients (MessageId, RecipientEmail)
          VALUES (?, ?)
        `).bind(messageId, recipient).run();
      }

      // Log activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: targetTenantId,
        activityType: isRoleBasedMessaging ? 'SEND_MESSAGE_DASHBOARD_ROLE_BASED' : 'SEND_MESSAGE_DASHBOARD',
        accessType: 'write',
        targetId: messageId.toString(),
        targetName: `Sent ${messageType} message to ${allRecipients.length} recipients`,
        ipAddress,
        userAgent,
        metadata: { 
          messageType, 
          priority, 
          recipientCount: allRecipients.length,
          isRoleBased: isRoleBasedMessaging
        }
      });

      return NextResponse.json({
        success: true,
        messageId: messageId,
        message: 'Message sent successfully'
      });
    }

  } catch (error) {
    console.error('Error sending message from dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

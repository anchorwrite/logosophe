import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import type { D1Result } from '@cloudflare/workers-types';

// POST /api/dashboard/messaging/messages/bulk-hard-delete - Bulk hard delete soft-deleted messages
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json() as { 
      tenantId?: string; 
      olderThanDays?: number;
      messageIds?: number[];
    };

    const { tenantId, olderThanDays, messageIds } = body;

    // Build query to find soft-deleted messages based on criteria
    let query = '';
    let params: any[] = [];
    let whereClause = 'WHERE m.IsDeleted = TRUE';

    if (messageIds && messageIds.length > 0) {
      // Specific message IDs provided
      whereClause += ` AND m.Id IN (${messageIds.map(() => '?').join(',')})`;
      params.push(...messageIds);
    } else if (olderThanDays && olderThanDays > 0) {
      // Messages older than specified days (based on creation time)
      whereClause += ` AND m.CreatedAt < datetime('now', '-${olderThanDays} days')`;
    }

    if (tenantId) {
      // Specific tenant
      whereClause += ` AND m.TenantId = ?`;
      params.push(tenantId);
    } else if (!isAdmin) {
      // Tenant admin: only their accessible tenants
      whereClause += ` AND m.TenantId IN (${accessibleTenants.map(() => '?').join(',')})`;
      params.push(...accessibleTenants);
    }

    // Get messages to be hard deleted
    const messagesQuery = `
      SELECT 
        m.Id,
        m.Subject,
        m.TenantId,
        m.CreatedAt,
        m.DeletedAt,
        COUNT(ma.Id) as AttachmentCount,
        COUNT(ml.Id) as LinkCount
      FROM Messages m
      LEFT JOIN MessageAttachments ma ON m.Id = ma.MessageId
      LEFT JOIN MessageLinks ml ON m.Id = ml.MessageId
      ${whereClause}
      GROUP BY m.Id
      ORDER BY m.CreatedAt ASC
    `;

    const messagesResult = await db.prepare(messagesQuery).bind(...params).all() as D1Result<{
      Id: number;
      Subject: string;
      TenantId: string;
      CreatedAt: string;
      DeletedAt: string;
      AttachmentCount: number;
      LinkCount: number;
    }>;

    const messages = messagesResult.results || [];

    if (messages.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No soft-deleted messages found matching criteria',
        deletedCount: 0
      });
    }

    // Get all attachments for these messages to delete from R2
    const messageIdsForAttachments = messages.map(m => m.Id);
    const attachmentsQuery = `
      SELECT ma.MessageId, ma.MediaId, mf.R2Key, mf.FileName
      FROM MessageAttachments ma
      JOIN MediaFiles mf ON ma.MediaId = mf.Id
      WHERE ma.MessageId IN (${messageIdsForAttachments.map(() => '?').join(',')})
    `;

    const attachmentsResult = await db.prepare(attachmentsQuery)
      .bind(...messageIdsForAttachments)
      .all() as D1Result<{ MessageId: number; MediaId: number; R2Key: string; FileName: string }>;

    const attachments = attachmentsResult.results || [];

    // Delete files from R2 storage first
    let r2DeletionErrors = 0;
    for (const attachment of attachments) {
      try {
        await env.MEDIA_BUCKET.delete(attachment.R2Key);
        console.log(`Deleted R2 file: ${attachment.FileName} (${attachment.R2Key})`);
      } catch (error) {
        console.error(`Failed to delete R2 file ${attachment.FileName}:`, error);
        r2DeletionErrors++;
      }
    }

    // Now hard delete all database records
    let deletedCount = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        // Delete MessageAttachments
        await db.prepare(`
          DELETE FROM MessageAttachments WHERE MessageId = ?
        `).bind(message.Id).run();

        // Delete MessageLinks
        await db.prepare(`
          DELETE FROM MessageLinks WHERE MessageId = ?
        `).bind(message.Id).run();

        // Delete MessageRecipients
        await db.prepare(`
          DELETE FROM MessageRecipients WHERE MessageId = ?
        `).bind(message.Id).run();

        // Finally delete the message itself
        await db.prepare(`
          DELETE FROM Messages WHERE Id = ?
        `).bind(message.Id).run();

        deletedCount++;

        // Log individual message deletion
        await normalizedLogging.logMessagingOperations({
          userEmail: session.user.email,
          tenantId: message.TenantId,
          activityType: 'BULK_HARD_DELETE_MESSAGE_DASHBOARD',
          accessType: 'write',
          targetId: message.Id.toString(),
          targetName: `Message "${message.Subject}" bulk hard deleted`,
          ipAddress: undefined,
          userAgent: undefined,
          metadata: {
            deleteType: 'bulk_hard',
            attachmentCount: message.AttachmentCount,
            linkCount: message.LinkCount,
            createdAt: message.CreatedAt,
            deletedAt: message.DeletedAt
          }
        });

      } catch (error) {
        console.error(`Error hard deleting message ${message.Id}:`, error);
        errors++;
      }
    }

    // Log bulk operation summary
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logMessagingOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'multiple',
      activityType: 'BULK_HARD_DELETE_SUMMARY_DASHBOARD',
      accessType: 'write',
      targetId: 'bulk-operation',
      targetName: `Bulk hard delete of ${deletedCount} soft-deleted messages`,
      ipAddress,
      userAgent,
      metadata: {
        deleteType: 'bulk_hard',
        totalMessages: messages.length,
        successfullyDeleted: deletedCount,
        errors: errors,
        r2DeletionErrors: r2DeletionErrors,
        totalAttachments: attachments.length,
        criteria: {
          tenantId,
          olderThanDays,
          messageIds: messageIds?.length || 0
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Bulk hard delete completed`,
      summary: {
        totalMessages: messages.length,
        successfullyDeleted: deletedCount,
        errors: errors,
        r2DeletionErrors: r2DeletionErrors,
        totalAttachments: attachments.length
      }
    });

  } catch (error) {
    console.error('Error during bulk hard delete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

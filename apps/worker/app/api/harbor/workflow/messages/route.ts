import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to send workflow messages' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const workflowId = searchParams.get('workflowId');

    if (!tenantId || !workflowId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: tenantId and workflowId' },
        { status: 400 }
      );
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (isAdmin) {
      // System admins have full access to all tenants
      // Continue with message sending
    } else {
      // Check if user is a tenant admin (Credentials table with tenant role)
      const tenantAdminCheck = await db.prepare(`
        SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).first();

      if (tenantAdminCheck) {
        // Tenant admins have full access within their assigned tenants
        // We need to verify they have access to this specific tenant
        const tenantAccessCheck = await db.prepare(`
          SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first();

        if (!tenantAccessCheck) {
          return NextResponse.json(
            { success: false, error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }
      } else {
        // Regular users need specific role assignments in the tenant
        // Follow the proper role checking logic from .cursorules
        
        // 1. Check TenantUsers table for base role
        const tenantUserCheck = await db.prepare(`
          SELECT RoleId FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first<{ RoleId: string }>();

        // 2. Check UserRoles table for additional roles
        const userRolesCheck = await db.prepare(`
          SELECT RoleId FROM UserRoles WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).all<{ RoleId: string }>();

        // 3. Collect all user roles
        const userRoles: string[] = [];
        
        if (tenantUserCheck) {
          userRoles.push(tenantUserCheck.RoleId);
        }
        
        if (userRolesCheck.results) {
          userRoles.push(...userRolesCheck.results.map(r => r.RoleId));
        }

        // 4. Check if user has any role that allows sending workflow messages
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer', 'subscriber'];
        const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
        
        if (!hasAllowedRole) {
          return NextResponse.json(
            { success: false, error: 'Your role does not allow sending workflow messages' },
            { status: 403 }
          );
        }
      }
    }

    // Verify the user has access to this workflow
    const workflowAccessCheck = await db.prepare(`
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `).bind(workflowId, access.email).first();

    if (!workflowAccessCheck) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this workflow' },
        { status: 403 }
      );
    }

    // Verify the workflow is still active
    const workflowStatusCheck = await db.prepare(`
      SELECT Status FROM Workflows WHERE Id = ?
    `).bind(workflowId).first<{ Status: string }>();

    if (!workflowStatusCheck || workflowStatusCheck.Status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'This workflow is no longer active' },
        { status: 400 }
      );
    }

    const requestData = await request.json() as {
      content: string;
      messageType?: 'request' | 'response' | 'upload' | 'share_link' | 'review';
      mediaFileIds?: number[];
    };

    if (!requestData.content && (!requestData.mediaFileIds || requestData.mediaFileIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Message content or media files are required' },
        { status: 400 }
      );
    }

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Create the message in the database
    const messageQuery = `
      INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, Content, MessageType, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const messageResult = await db.prepare(messageQuery).bind(
      messageId,
      workflowId,
      access.email,
      requestData.content || '',
      requestData.messageType || 'response',
      createdAt
    ).run();

    // If media files are attached, create separate messages for each
    if (requestData.mediaFileIds && requestData.mediaFileIds.length > 0) {
      for (const mediaFileId of requestData.mediaFileIds) {
        const mediaMessageId = crypto.randomUUID();
        
        await db.prepare(`
          INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, MediaFileId, Content, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          mediaMessageId,
          workflowId,
          access.email,
          'share_link',
          mediaFileId,
          '📎 Attached: ' + (await getMediaFileName(db, mediaFileId)),
          createdAt
        ).run();
      }
    }

    // Log the message sending
    try {
      const systemLogs = new SystemLogs(db);
      await systemLogs.logMessagingOperation({
        userEmail: access.email,
        tenantId: tenantId,
        activityType: 'workflow_message_sent',
        targetId: workflowId,
        targetName: `Message in workflow ${workflowId}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          messageType: requestData.messageType || 'response',
          hasMediaFiles: requestData.mediaFileIds ? requestData.mediaFileIds.length > 0 : false,
          mediaFileCount: requestData.mediaFileIds ? requestData.mediaFileIds.length : 0
        }
      });
    } catch (logError) {
      console.error('Failed to log message sending:', logError);
      // Continue with message sending even if logging fails
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error in workflow messages API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get media file name
async function getMediaFileName(db: any, mediaFileId: number): Promise<string> {
  try {
    const mediaFile = await db.prepare(`
      SELECT FileName FROM MediaFiles WHERE Id = ?
    `).bind(mediaFileId).first() as { FileName: string } | null;
    
    return mediaFile ? mediaFile.FileName : 'Unknown file';
  } catch (error) {
    console.error('Error getting media file name:', error);
    return 'Unknown file';
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
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
        const userTenantCheck = await db.prepare(`
          SELECT RoleId FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first<{ RoleId: string }>();

        if (!userTenantCheck) {
          return NextResponse.json(
            { success: false, error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }

        // Check if the user has a role that allows sending workflow messages
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer', 'subscriber'];
        if (!allowedRoles.includes(userTenantCheck.RoleId)) {
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

    const requestData = await request.json() as {
      content: string;
      messageType?: 'request' | 'response' | 'upload' | 'share_link' | 'review';
      mediaFileId?: number;
      shareToken?: string;
    };

    // Create the message in the database
    const messageQuery = `
      INSERT INTO WorkflowMessages (WorkflowId, SenderEmail, Content, MessageType, MediaFileId, ShareToken, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const messageResult = await db.prepare(messageQuery).bind(
      workflowId,
      access.email,
      requestData.content,
      requestData.messageType || 'message',
      requestData.mediaFileId || null,
      requestData.shareToken || null
    ).run();

    const messageId = messageResult.meta?.last_row_id;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Get the WorkflowDurableObject and notify it about the new message
    const workflowIdObj = env.WORKFLOW_DO.idFromName(workflowId);
    const workflowObj = env.WORKFLOW_DO.get(workflowIdObj);

    await workflowObj.fetch('http://localhost/workflow/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message_sent',
        data: {
          workflowId,
          messageId: messageId.toString(),
          senderEmail: access.email,
          content: requestData.content,
          messageType: requestData.messageType || 'message',
          mediaFileId: requestData.mediaFileId,
          shareToken: requestData.shareToken
        }
      })
    });

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
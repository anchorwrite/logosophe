import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext, createNormalizedMetadata } from '@/lib/normalized-logging';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to initiate workflows' }, { status: 403 });
    }

    const body = await request.json() as {
      tenantId: string;
      initiatorEmail: string;
      mediaFileId: number;
      workflowType: 'editor' | 'agent' | 'reviewer';
      participants: string[];
    };
    
    const { tenantId, initiatorEmail, mediaFileId, workflowType, participants } = body;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (isAdmin) {
      // System admins have full access to all tenants
      // Continue with workflow creation
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
            { error: 'You do not have access to this tenant' },
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
            { error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }

        // Check if the user has a role that allows workflow initiation
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer'];
        if (!allowedRoles.includes(userTenantCheck.RoleId)) {
          return NextResponse.json(
            { error: 'Your role does not allow workflow initiation' },
            { status: 403 }
          );
        }
      }
    }

    // Verify the media file exists and user has access to it
    const mediaFileCheck = await db.prepare(`
      SELECT 1 FROM MediaFiles WHERE Id = ? AND TenantId = ?
    `).bind(mediaFileId, tenantId).first();

    if (!mediaFileCheck) {
      return NextResponse.json(
        { error: 'Media file not found or you do not have access to it' },
        { status: 404 }
      );
    }

    // Create the workflow
    const workflowTitle = `Workflow for ${workflowType} review`;
    const createWorkflowQuery = `
      INSERT INTO Workflows (Title, Status, TenantId, CreatedAt)
      VALUES (?, 'active', ?, datetime('now'))
    `;

    const workflowResult = await db.prepare(createWorkflowQuery).bind(workflowTitle, tenantId).run();
    const workflowId = workflowResult.meta?.last_row_id;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Failed to create workflow' },
        { status: 500 }
      );
    }

    // Add participants to the workflow
    const allParticipants = [initiatorEmail, ...participants];
    for (const participantEmail of allParticipants) {
      const role = participantEmail === initiatorEmail ? 'initiator' : 'participant';
      
      await db.prepare(`
        INSERT INTO WorkflowParticipants (WorkflowId, ParticipantEmail, Role, JoinedAt)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(workflowId, participantEmail, role).run();
    }

    // Create initial message with media file
    await db.prepare(`
      INSERT INTO WorkflowMessages (WorkflowId, SenderEmail, Content, MessageType, MediaFileId, CreatedAt)
      VALUES (?, ?, ?, 'upload', ?, datetime('now'))
    `).bind(workflowId, initiatorEmail, `Initiated ${workflowType} workflow`, mediaFileId).run();

    // Log the workflow creation using normalized logging
    const normalizedLogging = new NormalizedLogging(db);
    const requestContext = extractRequestContext(request);
    
    const workflowMetadata = createNormalizedMetadata({
      workflowType,
      initiatorEmail,
      mediaFileId,
      participants: allParticipants,
      tenantId,
      operationType: 'workflow_initiation'
    });

    await normalizedLogging.logWorkflowOperations({
      userEmail: access.email,
      provider: 'credentials',
      tenantId,
      activityType: 'create_workflow',
      accessType: 'write',
      targetId: workflowId.toString(),
      targetName: workflowTitle,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: workflowMetadata
    });

    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow initiated successfully'
    });
  } catch (error) {
    console.error('Workflow initiate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { getWorkflowHistoryLogger } from '@/lib/workflow-history';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session directly as backup to ensure we have the email
    const session = await auth();
    const userEmail = access.email || session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workflow details from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(userEmail, db);

    // Get user's tenants if not admin
    let userTenantIds: string[] = [];
    if (!isAdmin) {
      const userTenants = await db.prepare(`
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      `).bind(userEmail).all();

      if (!userTenants.results || userTenants.results.length === 0) {
        return NextResponse.json({ error: 'No tenant access found' }, { status: 403 });
      }

      userTenantIds = userTenants.results.map((t: any) => t.TenantId);
    }

    // Get workflow details
    const workflowQuery = `
      SELECT w.*, 
             COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
             COUNT(DISTINCT wm.Id) as messageCount
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.Id = ?
      GROUP BY w.Id
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(id)
      .first() as any;

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check if user has access to this workflow's tenant
    if (!isAdmin && !userTenantIds.includes(workflow.TenantId)) {
      return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
    }

    // Get participants
    const participantsQuery = `
      SELECT wp.ParticipantEmail, wp.Role, wp.JoinedAt
      FROM WorkflowParticipants wp
      WHERE wp.WorkflowId = ?
      ORDER BY wp.JoinedAt
    `;

    const participants = await db.prepare(participantsQuery)
      .bind(id)
      .all() as any;

    // Check if user is a participant, has pending invitation, or is system admin
    const participantEmails = participants.results?.map((p: any) => p.ParticipantEmail) || [];
    const isParticipant = participantEmails.includes(userEmail);
    
    if (!isAdmin && !isParticipant) {
      // Check for pending invitation
      const invitationQuery = `
        SELECT 1 FROM WorkflowInvitations 
        WHERE WorkflowId = ? AND InviteeEmail = ? AND Status = 'pending'
      `;
      const invitation = await db.prepare(invitationQuery)
        .bind(id, userEmail)
        .first();
      
      if (!invitation) {
        return NextResponse.json({ error: 'You do not have permission to access this workflow' }, { status: 403 });
      }
    }

    // Get media files from WorkflowMessages table
    const mediaFilesQuery = `
      SELECT DISTINCT wm.MediaFileId, mf.FileName, mf.R2Key, mf.FileSize, mf.ContentType, mf.MediaType
      FROM WorkflowMessages wm
      JOIN MediaFiles mf ON wm.MediaFileId = mf.Id
      WHERE wm.WorkflowId = ? AND wm.MediaFileId IS NOT NULL
      ORDER BY wm.CreatedAt
    `;

    const mediaFiles = await db.prepare(mediaFilesQuery)
      .bind(id)
      .all() as any;

    // Get recent messages
    const messagesQuery = `
      SELECT wm.*
      FROM WorkflowMessages wm
      WHERE wm.WorkflowId = ?
      ORDER BY wm.CreatedAt ASC
      LIMIT 50
    `;

    const messages = await db.prepare(messagesQuery)
      .bind(id)
      .all() as any;

    return NextResponse.json({
      success: true,
      workflow,
      participants: participants.results || [],
      mediaFiles: mediaFiles.results || [],
      messages: messages.results || []
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      status?: 'active' | 'completed' | 'terminated';
      title?: string;
      action?: 'complete' | 'terminate' | 'reactivate' | 'delete' | 'hard_delete';
      completedBy?: string;
    };

    // Get workflow details from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get user's tenants if not admin
    let userTenantIds: string[] = [];
    if (!isAdmin) {
      const userTenants = await db.prepare(`
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      `).bind(access.email).all();

      if (!userTenants.results || userTenants.results.length === 0) {
        return NextResponse.json({ error: 'No tenant access found' }, { status: 403 });
      }

      userTenantIds = userTenants.results.map((t: any) => t.TenantId);
    }

    // Check if workflow exists and user has access
    const workflowQuery = `
      SELECT w.*, wp.ParticipantEmail
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ?
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(id)
      .all() as any;

    if (!workflow.results || workflow.results.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflowData = workflow.results[0];
    const participants = workflow.results.map((r: any) => r.ParticipantEmail).filter(Boolean);

    // Check if user has access to this workflow's tenant
    if (!isAdmin && !userTenantIds.includes(workflowData.TenantId)) {
      return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
    }

    // Check access permissions based on action
    const isInitiator = workflowData.InitiatorEmail === access.email;
    
    // For reactivate action: allow admins and initiators
    if (body.action === 'reactivate') {
      if (!isAdmin && !isInitiator) {
        return NextResponse.json({ error: 'You do not have permission to reactivate this workflow' }, { status: 403 });
      }
      // Also check that workflow is in a reactivatable state
      if (!['completed', 'terminated'].includes(workflowData.Status)) {
        return NextResponse.json({ error: 'Workflow cannot be reactivated from its current state' }, { status: 400 });
      }
    } else if (body.action === 'hard_delete') {
      // For hard delete: only admins can perform this action
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only administrators can permanently delete workflows' }, { status: 403 });
      }
      // Also check that workflow is in deleted state
      if (workflowData.Status !== 'deleted') {
        return NextResponse.json({ error: 'Only deleted workflows can be permanently deleted' }, { status: 400 });
      }
    } else {
      // For other actions: check if user is a participant or system admin
      if (!isAdmin && !participants.includes(access.email)) {
        return NextResponse.json({ error: 'You do not have permission to modify this workflow' }, { status: 403 });
      }
    }

    // Update workflow
    const updateFields = [];
    const updateValues = [];

    if (body.status !== undefined) {
      updateFields.push('Status = ?');
      updateValues.push(body.status);
    }

    if (body.title !== undefined) {
      updateFields.push('Title = ?');
      updateValues.push(body.title);
    }

    // Handle specific actions
    if (body.action === 'complete') {
      updateFields.push('Status = ?', 'CompletedAt = ?', 'CompletedBy = ?');
      updateValues.push('completed', new Date().toISOString(), access.email);
    } else if (body.action === 'terminate') {
      updateFields.push('Status = ?', 'UpdatedAt = ?');
      updateValues.push('terminated', new Date().toISOString());
    } else if (body.action === 'reactivate') {
      updateFields.push('Status = ?', 'CompletedAt = NULL', 'CompletedBy = NULL', 'UpdatedAt = ?');
      updateValues.push('active', new Date().toISOString());
    } else if (body.action === 'delete') {
      updateFields.push('Status = ?', 'UpdatedAt = ?');
      updateValues.push('deleted', new Date().toISOString());
    } else if (body.action === 'hard_delete') {
      // Hard delete: permanently remove all related records
      try {
        // First log the permanent deletion to WorkflowHistory before deleting
        const workflowHistoryLogger = await getWorkflowHistoryLogger();
        await workflowHistoryLogger.logWorkflowPermanentlyDeleted(workflowData, access.email);

        // Delete in order to respect foreign key constraints
        // 1. Delete WorkflowMessages
        await db.prepare('DELETE FROM WorkflowMessages WHERE WorkflowId = ?')
          .bind(id)
          .run();

        // 2. Delete WorkflowParticipants  
        await db.prepare('DELETE FROM WorkflowParticipants WHERE WorkflowId = ?')
          .bind(id)
          .run();

        // 3. Delete WorkflowInvitations
        await db.prepare('DELETE FROM WorkflowInvitations WHERE WorkflowId = ?')
          .bind(id)
          .run();

        // 4. Finally delete the Workflow itself
        await db.prepare('DELETE FROM Workflows WHERE Id = ?')
          .bind(id)
          .run();

        // Log to system logs
        const systemLogs = new SystemLogs(db);
        await systemLogs.logUserOperation({
          userEmail: access.email,
          tenantId: workflowData.TenantId,
          activityType: 'workflow_permanently_deleted',
          targetId: id,
          targetName: workflowData.Title,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: {
            action: 'hard_delete',
            originalStatus: workflowData.Status
          }
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Workflow permanently deleted successfully' 
        });

      } catch (deleteError) {
        console.error('Error during hard delete:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to permanently delete workflow' 
        }, { status: 500 });
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('UpdatedAt = ?');
      updateValues.push(new Date().toISOString());

      const updateQuery = `
        UPDATE Workflows 
        SET ${updateFields.join(', ')}
        WHERE Id = ?
      `;

      updateValues.push(id);

      await db.prepare(updateQuery)
        .bind(...updateValues)
        .run();

      // Log the workflow update
      try {
        const systemLogs = new SystemLogs(db);
        await systemLogs.logUserOperation({
          userEmail: access.email,
          tenantId: workflowData.TenantId,
          activityType: 'workflow_updated',
          targetId: id,
          targetName: workflowData.Title,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: {
            action: body.action || 'update',
            status: body.status,
            title: body.title
          }
        });

        // Log to WorkflowHistory
        const workflowHistoryLogger = await getWorkflowHistoryLogger();
        if (body.action === 'delete') {
          await workflowHistoryLogger.logWorkflowDeleted(workflowData, access.email);
        } else {
          await workflowHistoryLogger.logWorkflowUpdated(workflowData, access.email, body.action);
        }
      } catch (logError) {
        console.error('Failed to log workflow update:', logError);
        // Continue with workflow update even if logging fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Workflow updated successfully',
      workflowId: id
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
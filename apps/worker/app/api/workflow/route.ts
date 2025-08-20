import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { getWorkflowHistoryLogger } from '@/lib/workflow-history';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to create workflows' }, { status: 403 });
    }

    const body = await request.json() as {
      title: string;
      description?: string;
      tenantId: string;
      initiatorRole: string;
      participants: Array<{ email: string; role: string }>;
      mediaFileIds: number[];
    };
    const { title, description, tenantId, initiatorRole, participants, mediaFileIds } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
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

        if (userRoles.length === 0) {
          return NextResponse.json(
            { error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }

        // 4. Check if the user has any role that allows creating workflows
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer'];
        const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
        
        if (!hasAllowedRole) {
          return NextResponse.json(
            { error: 'Your role does not allow creating workflows' },
            { status: 403 }
          );
        }
      }
    }

    // Create workflow in database
    const workflowId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const insertWorkflowQuery = `
      INSERT INTO Workflows (Id, TenantId, Title, InitiatorEmail, Status, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `;

    await db.prepare(insertWorkflowQuery)
      .bind(workflowId, tenantId, title, access.email, createdAt, updatedAt)
      .run();

    // Add participants to workflow
    // Ensure the initiator is always added as a participant
    const allParticipants = [...participants];
    
    // Check if initiator is already in the participants list
    const initiatorExists = allParticipants.some(p => p.email === access.email);
    if (!initiatorExists) {
      allParticipants.push({ email: access.email, role: initiatorRole || 'author' });
    }

    for (const participant of allParticipants) {
      const joinedAt = new Date().toISOString();

      // Store the actual role chosen by the user, not hardcoded values
      const participantRole = participant.role;

      const insertParticipantQuery = `
        INSERT INTO WorkflowParticipants (WorkflowId, ParticipantEmail, Role, JoinedAt)
        VALUES (?, ?, ?, ?)
      `;

      await db.prepare(insertParticipantQuery)
        .bind(workflowId, participant.email, participantRole, joinedAt)
        .run();
    }

    // Create initial message
    const messageId = crypto.randomUUID();
    let initialMessage = `Workflow "${title}" initiated`;
    if (description) {
      initialMessage += `: ${description}`;
    }
    if (mediaFileIds && mediaFileIds.length > 0) {
      initialMessage += `\n\nShared ${mediaFileIds.length} media file(s)`;
    }

    await db.prepare(`
      INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, Content, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(messageId, workflowId, access.email, 'request', initialMessage, createdAt).run();

    // Create separate messages for each shared media file
    for (const mediaFileId of mediaFileIds) {
      const mediaMessageId = crypto.randomUUID();
      
      await db.prepare(`
        INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, MediaFileId, Content, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(mediaMessageId, workflowId, access.email, 'share_link', mediaFileId, 'Media file shared', createdAt).run();
    }

    // Log the workflow creation
    try {
      const normalizedLogging = new NormalizedLogging(db);
      const { ipAddress, userAgent } = extractRequestContext(request);
      await normalizedLogging.logWorkflowOperations({
        userEmail: access.email,
        tenantId: tenantId,
        activityType: 'workflow_created',
        accessType: 'write',
        targetId: workflowId,
        targetName: title,
        ipAddress,
        userAgent,
        metadata: {
          participants: participants.length,
          mediaFiles: mediaFileIds.length,
          initiatorRole: initiatorRole
        }
      });

      // Log to WorkflowHistory
      const workflowHistoryLogger = await getWorkflowHistoryLogger();
      await workflowHistoryLogger.logWorkflowCreated({
        Id: workflowId,
        TenantId: tenantId,
        InitiatorEmail: access.email,
        Title: title,
        Status: 'active',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString()
      }, access.email);
    } catch (logError) {
      console.error('Failed to log workflow creation:', logError);
      // Continue with workflow creation even if logging fails
    }

    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Workflow creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflows' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Get workflows from database
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

    let workflowsQuery = `
      SELECT w.*, 
             COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
             COUNT(DISTINCT wm.Id) as messageCount
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.TenantId = ?
    `;

    const queryParams = [tenantId];

    if (status) {
      workflowsQuery += ' AND w.Status = ?';
      queryParams.push(status);
    }

    // Filter by workflow participation or pending invitations (unless user is admin)
    if (!isAdmin) {
      workflowsQuery += ` AND (
        EXISTS (SELECT 1 FROM WorkflowParticipants wp2 WHERE wp2.WorkflowId = w.Id AND wp2.ParticipantEmail = ?)
        OR EXISTS (SELECT 1 FROM WorkflowInvitations wi WHERE wi.WorkflowId = w.Id AND wi.InviteeEmail = ? AND wi.Status = 'pending')
      )`;
      queryParams.push(access.email, access.email);
    }

    workflowsQuery += ' GROUP BY w.Id ORDER BY w.CreatedAt DESC';

    const workflows = await db.prepare(workflowsQuery)
      .bind(...queryParams)
      .all() as any;

    return NextResponse.json({
      success: true,
      workflows: workflows.results || []
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
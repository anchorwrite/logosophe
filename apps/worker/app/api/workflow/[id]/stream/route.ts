import { NextRequest } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  console.log('SSE Stream - Starting connection for workflow:', id);
  
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    console.log('SSE Stream - Access check result:', access);

    if (!access.hasAccess || !access.email) {
      console.log('SSE Stream - Access denied, returning 401');
      return new Response('Unauthorized', { status: 401 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(access.email, db);
    console.log('SSE Stream - Is admin:', isAdmin);

    // Get user's tenants if not admin
    let userTenantIds: string[] = [];
    if (!isAdmin) {
      // Follow the proper role checking logic from .cursorules
      
      // 1. Check TenantUsers table for base role
      const tenantUserCheck = await db.prepare(`
        SELECT RoleId FROM TenantUsers WHERE Email = ?
      `).bind(access.email).first<{ RoleId: string }>();

      // 2. Check UserRoles table for additional roles
      const userRolesCheck = await db.prepare(`
        SELECT RoleId FROM UserRoles WHERE Email = ?
      `).bind(access.email).all<{ RoleId: string }>();

      // 3. Collect all user roles
      const userRoles: string[] = [];
      
      if (tenantUserCheck) {
        userRoles.push(tenantUserCheck.RoleId);
      }
      
      if (userRolesCheck.results) {
        userRoles.push(...userRolesCheck.results.map(r => r.RoleId));
      }

      console.log('SSE Stream - User roles:', userRoles);

      if (userRoles.length === 0) {
        console.log('SSE Stream - No roles found, returning 403');
        return new Response('No tenant access found', { status: 403 });
      }

      // 4. Check if user has any role that allows SSE access
      const allowedRoles = ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber'];
      const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
      
      console.log('SSE Stream - Role check:', { userRoles, allowedRoles, isAllowed: hasAllowedRole });
      
      if (!hasAllowedRole) {
        console.log('SSE Stream - No allowed roles, returning 403');
        return new Response('You do not have permission to access workflow streams', { status: 403 });
      }

      // Get user's accessible tenants
      const userTenants = await db.prepare(`
        SELECT DISTINCT TenantId FROM TenantUsers WHERE Email = ?
        UNION
        SELECT DISTINCT TenantId FROM UserRoles WHERE Email = ?
      `).bind(access.email, access.email).all();

      console.log('SSE Stream - User tenants:', userTenants);

      if (!userTenants.results || userTenants.results.length === 0) {
        console.log('SSE Stream - No tenant access found, returning 403');
        return new Response('No tenant access found', { status: 403 });
      }

      userTenantIds = userTenants.results.map((t: any) => t.TenantId);
    }

    // Verify workflow exists and user has access
    const workflowQuery = `
      SELECT w.*, wp.ParticipantEmail
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ?
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(id)
      .all() as any;

    console.log('SSE Stream - Workflow query result:', workflow);

    if (!workflow.results || workflow.results.length === 0) {
      console.log('SSE Stream - Workflow not found, returning 404');
      return new Response('Workflow not found', { status: 404 });
    }

    const workflowData = workflow.results[0];
    const participants = workflow.results.map((r: any) => r.ParticipantEmail).filter(Boolean);

    console.log('SSE Stream - Workflow data:', workflowData);
    console.log('SSE Stream - Participants:', participants);

    // Check if user has access to this workflow's tenant
    if (!isAdmin && !userTenantIds.includes(workflowData.TenantId)) {
      console.log('SSE Stream - No access to workflow tenant, returning 403');
      return new Response('You do not have access to this workflow', { status: 403 });
    }

    // Check if user is a participant or system admin
    if (!isAdmin && !participants.includes(access.email)) {
      console.log('SSE Stream - Not a participant, returning 403');
      return new Response('You do not have permission to access this workflow', { status: 403 });
    }

    console.log('SSE Stream - Access granted, creating stream');

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: 'connected',
          workflowId: id,
          timestamp: new Date().toISOString()
        })}\n\n`;
        
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Set up polling for new messages
        let lastMessageId: string | null = null;
        let lastMessageTime: string | null = null;
        
        const pollInterval = setInterval(async () => {
          try {
            // Get the latest message ID to check for new messages
            const latestMessageQuery = `
              SELECT Id, CreatedAt FROM WorkflowMessages 
              WHERE WorkflowId = ? 
              ORDER BY CreatedAt DESC, Id DESC
              LIMIT 1
            `;
            
            const latestMessage = await db.prepare(latestMessageQuery)
              .bind(id)
              .first() as { Id: string; CreatedAt: string } | null;

            if (latestMessage && (latestMessage.Id !== lastMessageId || latestMessage.CreatedAt !== lastMessageTime)) {
              // Get new messages since last check
              let newMessagesQuery = `
                SELECT wm.*, mf.FileName, mf.ContentType, mf.MediaType
                FROM WorkflowMessages wm
                LEFT JOIN MediaFiles mf ON wm.MediaFileId = mf.Id
                WHERE wm.WorkflowId = ?
              `;

              let queryParams = [id];

              if (lastMessageId && lastMessageTime) {
                // Use both time and ID to ensure we don't miss messages or get duplicates
                newMessagesQuery += ` AND (wm.CreatedAt > ? OR (wm.CreatedAt = ? AND wm.Id > ?))`;
                queryParams.push(lastMessageTime, lastMessageTime, lastMessageId);
              }

              newMessagesQuery += ` ORDER BY wm.CreatedAt ASC, wm.Id ASC`;

              const newMessages = await db.prepare(newMessagesQuery)
                .bind(...queryParams)
                .all() as any;

              console.log('SSE Stream - New messages found:', newMessages.results?.length || 0);

              if (newMessages.results && newMessages.results.length > 0) {
                for (const message of newMessages.results) {
                  const sseMessage = `data: ${JSON.stringify({
                    type: 'message',
                    data: message,
                    timestamp: new Date().toISOString()
                  })}\n\n`;
                  
                  controller.enqueue(new TextEncoder().encode(sseMessage));
                }
                
                lastMessageId = latestMessage.Id;
                lastMessageTime = latestMessage.CreatedAt;
              }
            }

            // Check for workflow status changes
            const workflowStatusQuery = `
              SELECT Status, UpdatedAt FROM Workflows WHERE Id = ?
            `;
            
            const currentStatus = await db.prepare(workflowStatusQuery)
              .bind(id)
              .first() as { Status: string; UpdatedAt: string } | null;

            if (currentStatus) {
              const statusMessage = `data: ${JSON.stringify({
                type: 'status_update',
                data: {
                  status: currentStatus.Status,
                  updatedAt: currentStatus.UpdatedAt
                },
                timestamp: new Date().toISOString()
              })}\n\n`;
              
              controller.enqueue(new TextEncoder().encode(statusMessage));
            }

          } catch (error) {
            console.error('SSE polling error:', error);
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              error: 'Failed to poll for updates',
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(errorMessage));
          }
        }, 2000); // Poll every 2 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE stream error:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
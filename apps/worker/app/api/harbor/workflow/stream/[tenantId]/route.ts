import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const session = await auth();
    const { tenantId } = await params;

    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userEmail = session.user.email;

    // Check access control
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
      return new Response('Access denied', { status: 403 });
    }

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: 'connected',
          message: 'Connected to workflow stream',
          timestamp: new Date().toISOString()
        })}\n\n`;
        
        controller.enqueue(encoder.encode(initialMessage));

        // Set up polling for workflow updates
        let lastCheck = new Date().toISOString();
        const pollInterval = setInterval(async () => {
          try {
            // Check for new workflow messages since last check
            const newMessagesQuery = `
              SELECT DISTINCT 
                wm.Id,
                wm.WorkflowId,
                wm.SenderEmail,
                wm.Content,
                wm.CreatedAt,
                w.Title as WorkflowTitle
              FROM WorkflowMessages wm
              INNER JOIN Workflows w ON wm.WorkflowId = w.Id
              INNER JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
              WHERE w.TenantId = ?
                AND wp.ParticipantEmail = ?
                AND wm.CreatedAt > ?
                AND wm.SenderEmail != ?
                AND w.Status != 'deleted'
              ORDER BY wm.CreatedAt DESC
            `;

            const newMessages = await db.prepare(newMessagesQuery)
              .bind(tenantId, userEmail, lastCheck, userEmail)
              .all() as { results: any[] };

            if (newMessages.results && newMessages.results.length > 0) {
              // Send workflow message event
              const messageEvent = `data: ${JSON.stringify({
                type: 'workflow_message',
                data: {
                  messages: newMessages.results,
                  count: newMessages.results.length
                },
                timestamp: new Date().toISOString()
              })}\n\n`;
              
              controller.enqueue(encoder.encode(messageEvent));
            }

            // Send heartbeat every 45 seconds
            const now = new Date();
            if (now.getTime() % 45000 < 1000) { // Every ~45 seconds
              const heartbeat = `data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: now.toISOString()
              })}\n\n`;
              
              controller.enqueue(encoder.encode(heartbeat));
            }

            lastCheck = new Date().toISOString();

          } catch (error) {
            console.error('Error in workflow stream polling:', error);
            
            // Send error event
            const errorEvent = `data: ${JSON.stringify({
              type: 'error',
              message: 'Stream error occurred',
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(encoder.encode(errorEvent));
          }
        }, 15000); // Poll every 15 seconds

        // Cleanup on close
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
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Error in workflow stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

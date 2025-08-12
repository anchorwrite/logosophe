import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { addConnection, removeConnection } from '@/lib/messaging-events-broadcaster';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  let session;
  let userEmail: string;
  let tenantId: string;
  
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    userEmail = session.user.email;
    const paramsResult = await params;
    tenantId = paramsResult.tenantId;

    // Check if user has access to this tenant
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
        
        hasAccess = !!userTenant;
      }
    }

    if (!hasAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const now = new Date();
        
        // Create connection info object (matching the interface from messaging-events-broadcaster)
        const connectionInfo = {
          controller,
          userEmail,
          connectedAt: now,
          lastActivity: now
        };

        // Add connection to the tenant's connection set
        console.log(`Adding SSE connection for tenant ${tenantId}, user ${userEmail}`);
        addConnection(tenantId, connectionInfo);
        console.log(`SSE connection added successfully for tenant ${tenantId}`);

        // Send initial connection confirmation
        const data = JSON.stringify({
          type: 'connection:established',
          data: {
            tenantId,
            userEmail,
            timestamp: now.toISOString()
          }
        });
        
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        console.log(`Sent connection confirmation to user ${userEmail}`);

        // Set up heartbeat to keep connection alive and detect dead connections
        // Send heartbeat every 10 seconds to keep connections active
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeatData = JSON.stringify({
              type: 'heartbeat',
              data: {
                timestamp: new Date().toISOString()
              }
            });
            
            controller.enqueue(new TextEncoder().encode(`data: ${heartbeatData}\n\n`));
            connectionInfo.lastActivity = new Date();
            console.log(`Heartbeat sent to ${userEmail} at ${new Date().toISOString()}`);
          } catch (error) {
            // Connection is dead, clear interval and remove connection
            console.log(`Heartbeat failed for ${userEmail}, removing connection`);
            clearInterval(heartbeatInterval);
            removeConnection(tenantId, controller);
          }
        }, 10000); // Send heartbeat every 10 seconds instead of 30

        // Update activity on any data sent
        const originalEnqueue = controller.enqueue.bind(controller);
        controller.enqueue = function(chunk) {
          connectionInfo.lastActivity = new Date();
          return originalEnqueue(chunk);
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          removeConnection(tenantId, controller);
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=300, max=1000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    
    // Log specific error details for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        tenantId: (await params).tenantId,
        userEmail: session?.user?.email
      });
    }
    
    return new Response('Internal Server Error', { status: 500 });
  }
}



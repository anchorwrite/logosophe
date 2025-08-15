import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';

// Import the connections map from the stream route
// Note: This is a simplified status endpoint for monitoring purposes
export async function GET(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only system admins can access connection status
    if (!(await isSystemAdmin(session.user.email, db))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get connection status from the stream route
    // This is a simplified version - in a real implementation, you might want to
    // export the connections map or use a shared state management solution
    
    const status = {
      timestamp: new Date().toISOString(),
      totalTenants: 0,
      totalConnections: 0,
      tenantConnections: {},
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Connection status error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

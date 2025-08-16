import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getSystemSettings } from '@/lib/messaging';

interface SystemStatusResponse {
  isOnline: boolean;
  messagingEnabled: boolean;
  timestamp: string;
}

// GET /api/dashboard/messaging/status - Get messaging system status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      // Check if user is a tenant admin for any accessible tenants
      const accessibleTenants = await db.prepare(`
        SELECT DISTINCT tu.TenantId 
        FROM TenantUsers tu 
        WHERE tu.Email = ? AND tu.RoleId = 'tenant'
      `).bind(session.user.email).all() as { results: { TenantId: string }[] };

      if (accessibleTenants.results.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get system settings
    const settings = await getSystemSettings();
    const messagingEnabled = settings.messaging_enabled === 'true';

    // Check database connectivity with a simple query
    let databaseHealthy = false;
    try {
      await db.prepare('SELECT 1').first();
      databaseHealthy = true;
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      databaseHealthy = false;
    }

    // System is online if both messaging is enabled and database is healthy
    const isOnline = messagingEnabled && databaseHealthy;

    const response: SystemStatusResponse = {
      isOnline,
      messagingEnabled,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

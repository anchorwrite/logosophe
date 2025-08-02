import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow statistics' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = access.email; // Use email from session instead of query param
    const isGlobalAdminParam = searchParams.get('isGlobalAdmin');
    const tenantIdsParam = searchParams.get('tenantIds');

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(userEmail, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(userEmail).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view workflow statistics' }, { status: 403 });
    }

    // Build worker URL with appropriate parameters
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const params = new URLSearchParams();
    params.append('userEmail', userEmail);
    params.append('isGlobalAdmin', isGlobalAdmin.toString());

    // For global admins, we need to provide a tenant ID or handle it differently
    if (isGlobalAdmin) {
      // For global admins, we'll pass 'all' as tenant ID to indicate access to all tenants
      params.append('tenantId', 'all');
    } else if (tenantIdsParam) {
      params.append('tenantId', tenantIdsParam);
    } else {
      // If no tenant IDs provided for tenant admin, return error
      return NextResponse.json({ error: 'Tenant IDs are required for tenant administrators' }, { status: 400 });
    }

    const workerUrl = `${WORKER_URL}/workflow/stats?${params.toString()}`;
    console.log('Frontend: Calling worker URL:', workerUrl);
    console.log('Frontend: WORKER_URL env var:', WORKER_URL);
    
    const workerResponse = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userEmail}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Dashboard workflow stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
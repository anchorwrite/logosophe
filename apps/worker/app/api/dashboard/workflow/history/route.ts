import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to access workflow history' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to access workflow history' }, { status: 403 });
    }

    // Build worker URL with appropriate parameters
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const params = new URLSearchParams();
    params.append('userEmail', access.email);
    params.append('limit', limit);
    params.append('offset', offset);

    if (status) {
      params.append('status', status);
    }

    // For global admins, pass 'all' to get workflows from all tenants
    if (isGlobalAdmin) {
      params.append('tenantId', 'all');
    } else if (tenantId) {
      params.append('tenantId', tenantId);
    } else {
      // For tenant admins, get their accessible tenants
      const userTenants = await db.prepare(`
        SELECT DISTINCT tu.TenantId
        FROM TenantUsers tu
        WHERE tu.Email = ?
      `).bind(access.email).all() as { results: { TenantId: string }[] };

      if (userTenants.results && userTenants.results.length > 0) {
        params.append('tenantId', userTenants.results[0].TenantId);
      } else {
        return NextResponse.json({ error: 'No accessible tenants found' }, { status: 403 });
      }
    }

    const workerResponse = await fetch(`${WORKER_URL}/workflow/history?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access.email}`,
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
    console.error('Dashboard workflow history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
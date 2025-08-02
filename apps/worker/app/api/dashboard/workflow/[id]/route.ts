import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow details' }, { status: 403 });
    }

    const workflowId = id;
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view workflow details' }, { status: 403 });
    }

    // If tenant admin, verify they have access to this workflow's tenant
    if (!isGlobalAdmin) {
      const workflowTenant = await db.prepare(`
        SELECT w.TenantId
        FROM Workflows w
        WHERE w.Id = ?
      `).bind(workflowId).first() as { TenantId: string } | null;

      if (!workflowTenant) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const userTenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers tu
        WHERE tu.Email = ? AND tu.TenantId = ?
      `).bind(access.email, workflowTenant.TenantId).first();

      if (!userTenantAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
      }
    }

    // Build worker URL with appropriate parameters
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const queryParams = new URLSearchParams();
    queryParams.append('userEmail', access.email);
    queryParams.append('isGlobalAdmin', isGlobalAdmin.toString());

    const workerResponse = await fetch(`${WORKER_URL}/workflow/${workflowId}?${queryParams.toString()}`, {
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
    console.error('Dashboard workflow details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to manage workflows' }, { status: 403 });
    }

    const workflowId = id;
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const body = await request.json() as { action: string };
    const { action } = body;

    // Only allow specific admin actions
    if (!['terminate', 'reactivate', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Only terminate, reactivate, or delete are allowed' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to manage workflows' }, { status: 403 });
    }

    // If tenant admin, verify they have access to this workflow's tenant
    if (!isGlobalAdmin) {
      const workflowTenant = await db.prepare(`
        SELECT w.TenantId
        FROM Workflows w
        WHERE w.Id = ?
      `).bind(workflowId).first() as { TenantId: string } | null;

      if (!workflowTenant) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const userTenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers tu
        WHERE tu.Email = ? AND tu.TenantId = ?
      `).bind(access.email, workflowTenant.TenantId).first();

      if (!userTenantAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
      }
    }

    // Build worker URL with appropriate parameters
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const queryParams = new URLSearchParams();
    queryParams.append('userEmail', access.email);
    queryParams.append('isGlobalAdmin', isGlobalAdmin.toString());

    const workerResponse = await fetch(`${WORKER_URL}/workflow/${workflowId}?${queryParams.toString()}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access.email}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminEmail: access.email,
        ...body
      }),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Dashboard workflow management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
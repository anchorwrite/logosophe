import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to perform bulk workflow operations' }, { status: 403 });
    }

    const body = await request.json() as {
      action: string;
      workflowIds: string[];
    };
    const { action, workflowIds } = body;

    if (!action || !workflowIds || workflowIds.length === 0) {
      return NextResponse.json({ error: 'Action and workflow IDs are required' }, { status: 400 });
    }

    // Only allow specific admin actions
    if (!['pause', 'resume', 'terminate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Only pause, resume, or terminate are allowed' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to perform bulk workflow operations' }, { status: 403 });
    }

    // Verify access to all workflows
    const workflowTenants = await db.prepare(`
      SELECT w.Id, w.TenantId, w.Status
      FROM Workflows w
      WHERE w.Id IN (${workflowIds.map(() => '?').join(',')})
    `).bind(...workflowIds).all() as { results: { Id: string; TenantId: string; Status: string }[] };

    if (!workflowTenants.results || workflowTenants.results.length !== workflowIds.length) {
      return NextResponse.json({ error: 'One or more workflows not found' }, { status: 404 });
    }

    // If tenant admin, verify they have access to all workflow tenants
    if (!isGlobalAdmin) {
      const userTenants = await db.prepare(`
        SELECT DISTINCT tu.TenantId
        FROM TenantUsers tu
        WHERE tu.Email = ?
      `).bind(access.email).all() as { results: { TenantId: string }[] };

      const userTenantIds = userTenants.results?.map(t => t.TenantId) || [];
      const workflowTenantIds = workflowTenants.results.map(w => w.TenantId);

      const hasAccessToAll = workflowTenantIds.every(tenantId => userTenantIds.includes(tenantId));
      if (!hasAccessToAll) {
        return NextResponse.json({ error: 'You do not have access to all selected workflows' }, { status: 403 });
      }
    }

    // Verify workflows can be acted upon
    const validWorkflows = workflowTenants.results.filter(workflow => {
      switch (action) {
        case 'pause':
          return workflow.Status === 'active';
        case 'resume':
          return workflow.Status === 'paused';
        case 'terminate':
          return workflow.Status === 'active' || workflow.Status === 'paused';
        default:
          return false;
      }
    });

    if (validWorkflows.length === 0) {
      return NextResponse.json({ error: 'No workflows can be acted upon with the selected action' }, { status: 400 });
    }

    // Since the worker doesn't have bulk operations, implement them in the frontend
    // by making individual calls to update each workflow
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const results = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [] as string[]
    };

    for (const workflow of validWorkflows) {
      try {
        const params = new URLSearchParams();
        params.append('tenantId', workflow.TenantId);

        const workerResponse = await fetch(`${WORKER_URL}/workflow/${workflow.Id}?${params.toString()}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${access.email}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            status: action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'terminated',
            adminEmail: access.email,
          }),
        });

        if (workerResponse.ok) {
          results.processedCount++;
        } else {
          results.failedCount++;
          const error = await workerResponse.text();
          results.errors.push(`Workflow ${workflow.Id}: ${error}`);
        }
      } catch (error) {
        results.failedCount++;
        results.errors.push(`Workflow ${workflow.Id}: ${error}`);
      }
    }

    return NextResponse.json({
      ...results,
      totalCount: workflowIds.length
    });

  } catch (error) {
    console.error('Dashboard bulk workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
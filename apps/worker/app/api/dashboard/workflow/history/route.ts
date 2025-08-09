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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    // Build query based on user type with tenant and initiator information
    let workflowsQuery = `
      SELECT 
        w.Id,
        w.Title,
        w.Status,
        w.CreatedAt,
        w.CompletedAt,
        w.CompletedBy,
        w.TenantId,
        w.InitiatorEmail,
        t.Name as TenantName,
        tu.RoleId as initiatorRole,
        COUNT(wm.Id) as messageCount,
        MAX(wm.CreatedAt) as lastActivity,
        COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
        CASE 
          WHEN w.Status = 'completed' THEN 'completed'
          WHEN w.Status = 'terminated' THEN 'terminated'
          WHEN w.Status = 'deleted' THEN 'deleted'
          ELSE 'created'
        END as EventType,
        CASE 
          WHEN w.Status = 'completed' THEN w.CompletedAt
          WHEN w.Status = 'terminated' THEN w.UpdatedAt
          WHEN w.Status = 'deleted' THEN w.UpdatedAt
          ELSE w.CreatedAt
        END as EventTimestamp
      FROM Workflows w
      LEFT JOIN Tenants t ON w.TenantId = t.Id
      LEFT JOIN TenantUsers tu ON w.InitiatorEmail = tu.Email AND w.TenantId = tu.TenantId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
    `;

    const queryParams: any[] = [];

    // Add WHERE clause based on user type and filters
    if (isGlobalAdmin) {
      // Global admins can see all workflows
      if (status) {
        workflowsQuery += ` WHERE w.Status = ?`;
        queryParams.push(status);
      }
    } else {
      // Tenant admins can only see workflows in their accessible tenants
      const userTenants = await db.prepare(`
        SELECT DISTINCT tu.TenantId
        FROM TenantUsers tu
        WHERE tu.Email = ?
      `).bind(access.email).all() as { results: { TenantId: string }[] };

      if (!userTenants.results || userTenants.results.length === 0) {
        return NextResponse.json({ error: 'No accessible tenants found' }, { status: 403 });
      }

      const accessibleTenants = userTenants.results.map(t => t.TenantId);
      const targetTenantId = tenantId || accessibleTenants[0];

      // Verify the target tenant is accessible
      if (!accessibleTenants.includes(targetTenantId)) {
        return NextResponse.json({ error: 'You do not have access to this tenant' }, { status: 403 });
      }

      workflowsQuery += ` WHERE w.TenantId = ?`;
      queryParams.push(targetTenantId);

      if (status) {
        workflowsQuery += ` AND w.Status = ?`;
        queryParams.push(status);
      }
    }

    workflowsQuery += `
      GROUP BY w.Id, w.Title, w.Status, w.CreatedAt, w.UpdatedAt, w.CompletedAt, w.CompletedBy, w.TenantId, w.InitiatorEmail, t.Name, tu.RoleId
      ORDER BY w.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);

    const workflows = await db.prepare(workflowsQuery).bind(...queryParams).all();

    return NextResponse.json({
      success: true,
      workflows: workflows.results || []
    });

  } catch (error) {
    console.error('Dashboard workflow history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
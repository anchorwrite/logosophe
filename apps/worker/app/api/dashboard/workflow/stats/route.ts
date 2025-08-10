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

    // Build query based on user type
    let statsQuery = `
      SELECT 
        COUNT(*) as totalWorkflows,
        SUM(CASE WHEN Status = 'active' THEN 1 ELSE 0 END) as activeWorkflows,
        SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as completedWorkflows,
        SUM(CASE WHEN Status = 'cancelled' THEN 1 ELSE 0 END) as cancelledWorkflows,
        AVG(CASE WHEN Status = 'completed' THEN 
          (julianday(CompletedAt) - julianday(CreatedAt)) 
        ELSE NULL END) as avgCompletionDays
      FROM Workflows
    `;

    let todayStatsQuery = `
      SELECT 
        COUNT(CASE WHEN Status = 'completed' AND date(CompletedAt) = date('now') THEN 1 END) as completedToday,
        COUNT(CASE WHEN date(CreatedAt) = date('now') THEN 1 END) as initiatedToday,
        COUNT(CASE WHEN Status = 'cancelled' AND date(CreatedAt) = date('now') THEN 1 END) as terminatedToday
      FROM Workflows
    `;

    let pendingWorkflowsQuery = `
      SELECT COUNT(DISTINCT w.Id) as pendingWorkflows
      FROM Workflows w
      JOIN WorkflowInvitations wi ON w.Id = wi.WorkflowId
      WHERE wi.Status = 'pending' AND w.Status = 'active'
    `;



    const queryParams: any[] = [];
    let targetTenantIds: string[] = [];

    // Add WHERE clause based on user type
    if (isGlobalAdmin) {
      // Global admins can see stats for all workflows
      // No additional WHERE clause needed
    } else {
      // Tenant admins can only see stats for their accessible tenants
      const userTenants = await db.prepare(`
        SELECT DISTINCT tu.TenantId
        FROM TenantUsers tu
        WHERE tu.Email = ?
      `).bind(userEmail).all() as { results: { TenantId: string }[] };

      if (!userTenants.results || userTenants.results.length === 0) {
        return NextResponse.json({ error: 'No accessible tenants found' }, { status: 403 });
      }

      const accessibleTenants = userTenants.results.map(t => t.TenantId);
      targetTenantIds = tenantIdsParam ? tenantIdsParam.split(',') : accessibleTenants;

      // Verify all target tenants are accessible
      for (const tenantId of targetTenantIds) {
        if (!accessibleTenants.includes(tenantId)) {
          return NextResponse.json({ error: `You do not have access to tenant ${tenantId}` }, { status: 403 });
        }
      }

      // Add tenant filter to all queries
      const placeholders = targetTenantIds.map(() => '?').join(',');
      statsQuery += ` WHERE TenantId IN (${placeholders})`;
      todayStatsQuery += ` WHERE TenantId IN (${placeholders})`;
      pendingWorkflowsQuery += ` WHERE w.TenantId IN (${placeholders})`;

      queryParams.push(...targetTenantIds, ...targetTenantIds, ...targetTenantIds);
    }

    const stats = await db.prepare(statsQuery).bind(...queryParams.slice(0, isGlobalAdmin ? 0 : targetTenantIds.length)).first();
    const todayStats = await db.prepare(todayStatsQuery).bind(...queryParams.slice(0, isGlobalAdmin ? 0 : targetTenantIds.length)).first();
    const pendingWorkflows = await db.prepare(pendingWorkflowsQuery).bind(...queryParams.slice(0, isGlobalAdmin ? 0 : targetTenantIds.length)).first();

    return NextResponse.json({
      success: true,
      stats: {
        totalWorkflows: stats?.totalWorkflows || 0,
        activeWorkflows: stats?.activeWorkflows || 0,
        completedToday: todayStats?.completedToday || 0,
        initiatedToday: todayStats?.initiatedToday || 0,
        terminatedToday: todayStats?.terminatedToday || 0,
        pendingWorkflows: pendingWorkflows?.pendingWorkflows || 0
      }
    });

  } catch (error) {
    console.error('Dashboard workflow stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
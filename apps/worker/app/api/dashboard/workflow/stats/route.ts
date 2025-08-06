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

    let recentActivityQuery = `
      SELECT 
        COUNT(*) as recentWorkflows,
        COUNT(DISTINCT w.Id) as workflowsWithMessages
      FROM Workflows w
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.CreatedAt >= datetime('now', '-7 days')
    `;

    let topParticipantsQuery = `
      SELECT 
        wp.ParticipantEmail,
        COUNT(DISTINCT w.Id) as workflowCount,
        COUNT(wm.Id) as messageCount
      FROM WorkflowParticipants wp
      JOIN Workflows w ON wp.WorkflowId = w.Id
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId AND wm.SenderEmail = wp.ParticipantEmail
      GROUP BY wp.ParticipantEmail
      ORDER BY messageCount DESC, workflowCount DESC
      LIMIT 5
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
      recentActivityQuery += ` AND w.TenantId IN (${placeholders})`;
      topParticipantsQuery += ` WHERE w.TenantId IN (${placeholders})`;

      queryParams.push(...targetTenantIds, ...targetTenantIds, ...targetTenantIds);
    }

    const stats = await db.prepare(statsQuery).bind(...queryParams.slice(0, isGlobalAdmin ? 0 : targetTenantIds.length)).first();
    const recentActivity = await db.prepare(recentActivityQuery).bind(...queryParams.slice(isGlobalAdmin ? 0 : targetTenantIds.length, isGlobalAdmin ? 0 : targetTenantIds.length * 2)).first();
    const topParticipants = await db.prepare(topParticipantsQuery).bind(...queryParams.slice(isGlobalAdmin ? 0 : targetTenantIds.length * 2)).all();

    return NextResponse.json({
      success: true,
      stats: {
        totalWorkflows: stats?.totalWorkflows || 0,
        activeWorkflows: stats?.activeWorkflows || 0,
        completedWorkflows: stats?.completedWorkflows || 0,
        cancelledWorkflows: stats?.cancelledWorkflows || 0,
        avgCompletionDays: stats?.avgCompletionDays || 0,
        recentWorkflows: recentActivity?.recentWorkflows || 0,
        workflowsWithMessages: recentActivity?.workflowsWithMessages || 0,
        topParticipants: topParticipants?.results || []
      }
    });

  } catch (error) {
    console.error('Dashboard workflow stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
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
      return NextResponse.json({ error: 'You do not have permission to view workflow analytics' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const isGlobalAdminParam = searchParams.get('isGlobalAdmin');
    const tenantIdsParam = searchParams.get('tenantIds');
    const timeRange = searchParams.get('timeRange') || '30d';

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(userEmail, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(userEmail).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view workflow analytics' }, { status: 403 });
    }

    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const startDateStr = startDate.toISOString();

    // Build tenant filter
    let tenantFilter = '';
    let tenantParams: string[] = [];
    
    if (!isGlobalAdmin && tenantIdsParam) {
      const tenantIds = tenantIdsParam.split(',');
      tenantFilter = `AND w.TenantId IN (${tenantIds.map(() => '?').join(',')})`;
      tenantParams = tenantIds;
    }

    // Get basic metrics
    const basicMetricsQuery = `
      SELECT 
        COUNT(*) as totalWorkflows,
        SUM(CASE WHEN w.Status = 'active' THEN 1 ELSE 0 END) as activeWorkflows,
        SUM(CASE WHEN w.Status = 'completed' THEN 1 ELSE 0 END) as completedWorkflows,
        SUM(CASE WHEN w.Status = 'terminated' THEN 1 ELSE 0 END) as terminatedWorkflows,
        AVG(CASE WHEN w.Status = 'completed' THEN 
          (julianday(w.UpdatedAt) - julianday(w.CreatedAt)) * 24 * 60 
        ELSE NULL END) as avgCompletionTime
      FROM Workflows w
      WHERE w.CreatedAt >= ? ${tenantFilter}
    `;

    const basicMetrics = await db.prepare(basicMetricsQuery)
      .bind(startDateStr, ...tenantParams)
      .first() as {
        totalWorkflows: number;
        activeWorkflows: number;
        completedWorkflows: number;
        terminatedWorkflows: number;
        avgCompletionTime: number;
      };

    // Get average participants and messages
    const avgMetricsQuery = `
      SELECT 
        AVG(participant_count) as avgParticipants,
        AVG(message_count) as avgMessages
      FROM (
        SELECT 
          w.Id,
          COUNT(DISTINCT wp.ParticipantEmail) as participant_count,
          COUNT(DISTINCT wm.Id) as message_count
        FROM Workflows w
        LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
        LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
        WHERE w.CreatedAt >= ? ${tenantFilter}
        GROUP BY w.Id
      )
    `;

    const avgMetrics = await db.prepare(avgMetricsQuery)
      .bind(startDateStr, ...tenantParams)
      .first() as {
        avgParticipants: number;
        avgMessages: number;
      };

    // Get top tenants
    const topTenantsQuery = `
      SELECT 
        t.Name as tenantName,
        COUNT(*) as workflowCount
      FROM Workflows w
      JOIN Tenants t ON w.TenantId = t.Id
      WHERE w.CreatedAt >= ? ${tenantFilter}
      GROUP BY w.TenantId, t.Name
      ORDER BY workflowCount DESC
      LIMIT 10
    `;

    const topTenants = await db.prepare(topTenantsQuery)
      .bind(startDateStr, ...tenantParams)
      .all() as { results: { tenantName: string; workflowCount: number }[] };

    // Get top initiators
    const topInitiatorsQuery = `
      SELECT 
        w.InitiatorEmail as email,
        COUNT(*) as workflowCount
      FROM Workflows w
      WHERE w.CreatedAt >= ? ${tenantFilter}
      GROUP BY w.InitiatorEmail
      ORDER BY workflowCount DESC
      LIMIT 10
    `;

    const topInitiators = await db.prepare(topInitiatorsQuery)
      .bind(startDateStr, ...tenantParams)
      .all() as { results: { email: string; workflowCount: number }[] };

    // Get status distribution
    const statusDistributionQuery = `
      SELECT 
        w.Status as status,
        COUNT(*) as count
      FROM Workflows w
      WHERE w.CreatedAt >= ? ${tenantFilter}
      GROUP BY w.Status
      ORDER BY count DESC
    `;

    const statusDistribution = await db.prepare(statusDistributionQuery)
      .bind(startDateStr, ...tenantParams)
      .all() as { results: { status: string; count: number }[] };

    // Get daily activity for the last 7 days
    const dailyActivityQuery = `
      SELECT 
        DATE(w.CreatedAt) as date,
        COUNT(*) as created,
        SUM(CASE WHEN w.Status = 'completed' AND DATE(w.UpdatedAt) = DATE(w.CreatedAt) THEN 1 ELSE 0 END) as completed
      FROM Workflows w
      WHERE w.CreatedAt >= DATE('now', '-7 days') ${tenantFilter}
      GROUP BY DATE(w.CreatedAt)
      ORDER BY date
    `;

    const dailyActivity = await db.prepare(dailyActivityQuery)
      .bind(...tenantParams)
      .all() as { results: { date: string; created: number; completed: number }[] };

    // Worker doesn't have analytics endpoint, so we'll use empty data for now
    const workerData: { weeklyTrends?: any[]; monthlyPerformance?: any[] } = {
      weeklyTrends: [],
      monthlyPerformance: []
    };

    // Combine database metrics with worker data
    const metrics = {
      totalWorkflows: basicMetrics.totalWorkflows || 0,
      activeWorkflows: basicMetrics.activeWorkflows || 0,
      completedWorkflows: basicMetrics.completedWorkflows || 0,
      terminatedWorkflows: basicMetrics.terminatedWorkflows || 0,
      averageCompletionTime: basicMetrics.avgCompletionTime || 0,
      averageParticipants: avgMetrics.avgParticipants || 0,
      averageMessages: avgMetrics.avgMessages || 0,
      topTenants: topTenants.results || [],
      topInitiators: topInitiators.results || [],
      statusDistribution: statusDistribution.results || [],
      dailyActivity: dailyActivity.results || [],
      weeklyTrends: workerData.weeklyTrends || [],
      monthlyPerformance: workerData.monthlyPerformance || []
    };

    return NextResponse.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('Dashboard workflow analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
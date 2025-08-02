import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view system health' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Only global administrators can view system health' }, { status: 403 });
    }

    // Check database health
    let databaseStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    let activeConnections = 0;
    let averageResponseTime = 0;

    try {
      const startTime = Date.now();
      await db.prepare('SELECT 1').first();
      const responseTime = Date.now() - startTime;
      averageResponseTime = responseTime;
      
      if (responseTime > 1000) {
        databaseStatus = 'warning';
      } else if (responseTime > 5000) {
        databaseStatus = 'error';
      }
    } catch (error) {
      databaseStatus = 'error';
      averageResponseTime = 0;
    }

    // Check worker health
    let workerStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    try {
      const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
      const workerResponse = await fetch(`${WORKER_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access.email}`,
          'Content-Type': 'application/json',
        },
      });

      if (!workerResponse.ok) {
        workerStatus = 'error';
      } else {
        const workerHealth = await workerResponse.json() as { status?: string };
        if (workerHealth.status === 'warning') {
          workerStatus = 'warning';
        } else if (workerHealth.status === 'error') {
          workerStatus = 'error';
        }
      }
    } catch (error) {
      workerStatus = 'error';
    }

    // Get storage usage (simulated)
    const storageResult = await db.prepare(`
      SELECT COUNT(*) as totalWorkflows,
             COUNT(CASE WHEN Status = 'active' THEN 1 END) as activeWorkflows,
             COUNT(CASE WHEN Status = 'completed' THEN 1 END) as completedWorkflows
      FROM Workflows
    `).first() as { totalWorkflows: number; activeWorkflows: number; completedWorkflows: number };

    const totalWorkflows = storageResult?.totalWorkflows || 0;
    const activeWorkflows = storageResult?.activeWorkflows || 0;
    const completedWorkflows = storageResult?.completedWorkflows || 0;

    // Calculate storage usage (simulated based on workflow count)
    const storageUsage = Math.min(95, Math.max(10, (totalWorkflows / 1000) * 100));

    // Get system uptime (simulated)
    const uptime = Math.floor(Math.random() * 86400 * 30) + 86400; // 1-30 days in seconds

    // Get error rate (simulated)
    const errorRate = Math.random() * 3; // 0-3%

    // Get last backup time
    const lastBackup = new Date(Date.now() - Math.random() * 86400 * 7).toISOString(); // Within last 7 days

    // Get pending and stuck workflows
    const pendingWorkflows = await db.prepare(`
      SELECT COUNT(*) as count
      FROM Workflows
      WHERE Status = 'active' AND CreatedAt < datetime('now', '-1 hour')
    `).first() as { count: number };

    const stuckWorkflows = await db.prepare(`
      SELECT COUNT(*) as count
      FROM Workflows
      WHERE Status = 'active' AND CreatedAt < datetime('now', '-24 hours')
    `).first() as { count: number };

    // Get performance metrics
    const performanceResult = await db.prepare(`
      SELECT 
        COUNT(*) as workflowsPerHour,
        AVG(CASE WHEN Status = 'completed' THEN 
          (julianday(UpdatedAt) - julianday(CreatedAt)) * 24 * 60 
        ELSE NULL END) as avgDuration,
        COUNT(CASE WHEN Status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completionRate
      FROM Workflows
      WHERE CreatedAt >= datetime('now', '-1 hour')
    `).first() as { workflowsPerHour: number; avgDuration: number; completionRate: number };

    const messagesPerHour = await db.prepare(`
      SELECT COUNT(*) as count
      FROM WorkflowMessages
      WHERE CreatedAt >= datetime('now', '-1 hour')
    `).first() as { count: number };

    // Get system alerts
    const alertsResult = await db.prepare(`
      SELECT 
        Id as id,
        LogType as type,
        Metadata as message,
        Timestamp as timestamp
      FROM SystemLogs
      WHERE LogType IN ('ERROR', 'WARNING') 
        AND Timestamp >= datetime('now', '-24 hours')
      ORDER BY Timestamp DESC
      LIMIT 10
    `).all() as { results: { id: string; type: string; message: string; timestamp: string }[] };

    const systemAlerts = alertsResult.results.map(alert => ({
      id: alert.id,
      type: alert.type === 'ERROR' ? 'error' : 'warning' as 'info' | 'warning' | 'error',
      message: alert.message || 'System alert',
      timestamp: alert.timestamp
    }));

    // Build health response
    const health = {
      databaseStatus,
      workerStatus,
      storageUsage: Math.round(storageUsage),
      activeConnections: Math.floor(Math.random() * 100) + 10, // Simulated
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      uptime,
      lastBackup,
      pendingWorkflows: pendingWorkflows?.count || 0,
      stuckWorkflows: stuckWorkflows?.count || 0,
      systemAlerts,
      performanceMetrics: {
        workflowsPerHour: performanceResult?.workflowsPerHour || 0,
        messagesPerHour: messagesPerHour?.count || 0,
        averageWorkflowDuration: performanceResult?.avgDuration || 0,
        completionRate: Math.round((performanceResult?.completionRate || 0) * 100) // 100
      }
    };

    return NextResponse.json({
      success: true,
      health
    });

  } catch (error) {
    console.error('Dashboard workflow health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
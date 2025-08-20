import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const tenantIdsParam = searchParams.get('tenantIds');

    // Build tenant filter
    let tenantFilter = '';
    let tenantBindings: any[] = [];
    
    if (tenantIdsParam && !isAdmin) {
      // Tenant admin can only see their own tenant
      const tenantIds = tenantIdsParam.split(',');
      if (tenantIds.length > 0) {
        tenantFilter = `AND TenantId IN (${tenantIds.map(() => '?').join(',')})`;
        tenantBindings = tenantIds;
      }
    } else if (tenantIdsParam && isAdmin) {
      // System admin can filter by specific tenants
      const tenantIds = tenantIdsParam.split(',');
      if (tenantIds.length > 0) {
        tenantFilter = `AND TenantId IN (${tenantIds.map(() => '?').join(',')})`;
        tenantBindings = tenantIds;
      }
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 1. System Overview - Operations by category
    const overviewQuery = `
      SELECT 
        LogType,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT UserEmail) as UniqueUsers,
        COUNT(DISTINCT TenantId) as ActiveTenants,
        COUNT(DISTINCT DATE(Timestamp)) as ActiveDays
      FROM SystemLogs 
      WHERE Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY LogType
      ORDER BY TotalOperations DESC
    `;

    const overviewResult = await db.prepare(overviewQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 2. Daily Trends - Operations over time
    const dailyTrendsQuery = `
      SELECT 
        DATE(Timestamp) as Date,
        LogType,
        COUNT(*) as DailyOperations,
        COUNT(DISTINCT UserEmail) as DailyUsers
      FROM SystemLogs 
      WHERE Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY DATE(Timestamp), LogType
      ORDER BY Date DESC, LogType
    `;

    const dailyTrendsResult = await db.prepare(dailyTrendsQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 3. Top Users by Activity
    const topUsersQuery = `
      SELECT 
        UserEmail,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT LogType) as OperationTypes,
        COUNT(DISTINCT DATE(Timestamp)) as ActiveDays,
        MAX(Timestamp) as LastActivity
      FROM SystemLogs 
      WHERE Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY UserEmail
      ORDER BY TotalOperations DESC
      LIMIT 10
    `;

    const topUsersResult = await db.prepare(topUsersQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 4. Media Operations Breakdown
    const mediaOperationsQuery = `
      SELECT 
        ActivityType,
        COUNT(*) as OperationCount,
        COUNT(DISTINCT TargetId) as UniqueFiles,
        COUNT(DISTINCT UserEmail) as UniqueUsers
      FROM SystemLogs 
      WHERE LogType = 'media_operations' 
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY ActivityType
      ORDER BY OperationCount DESC
    `;

    const mediaOperationsResult = await db.prepare(mediaOperationsQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 5. Authentication Provider Usage
    const authProvidersQuery = `
      SELECT 
        Provider,
        COUNT(*) as SignInCount,
        COUNT(DISTINCT UserEmail) as UniqueUsers
      FROM SystemLogs 
      WHERE LogType = 'authentication' 
        AND ActivityType = 'signin'
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY Provider
      ORDER BY SignInCount DESC
    `;

    const authProvidersResult = await db.prepare(authProvidersQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 6. Trend Analysis - Week over Week comparison
    const trendAnalysisQuery = `
      WITH current_week AS (
        SELECT 
          LogType,
          COUNT(*) as current_count
        FROM SystemLogs 
        WHERE Timestamp >= datetime('now', '-7 days')
          AND IsDeleted = 0
          ${tenantFilter}
        GROUP BY LogType
      ),
      previous_week AS (
        SELECT 
          LogType,
          COUNT(*) as previous_count
        FROM SystemLogs 
        WHERE Timestamp >= datetime('now', '-14 days')
          AND Timestamp < datetime('now', '-7 days')
          AND IsDeleted = 0
          ${tenantFilter}
        GROUP BY LogType
      )
      SELECT 
        COALESCE(cw.LogType, pw.LogType) as LogType,
        COALESCE(cw.current_count, 0) as current_count,
        COALESCE(pw.previous_count, 0) as previous_count,
        CASE 
          WHEN COALESCE(pw.previous_count, 0) = 0 THEN 
            CASE WHEN COALESCE(cw.current_count, 0) > 0 THEN 100.0 ELSE 0.0 END
          ELSE 
            ROUND(((COALESCE(cw.current_count, 0) - COALESCE(pw.previous_count, 0)) * 100.0) / COALESCE(pw.previous_count, 0), 2)
        END as percent_change
      FROM current_week cw
      FULL OUTER JOIN previous_week pw ON cw.LogType = pw.LogType
      ORDER BY current_count DESC
    `;

    const trendAnalysisResult = await db.prepare(trendAnalysisQuery)
      .bind(...tenantBindings, ...tenantBindings)
      .all() as any;

    // 7. Peak Activity Hours
    const peakHoursQuery = `
      SELECT 
        CAST(strftime('%H', Timestamp) AS INTEGER) as Hour,
        COUNT(*) as ActivityCount
      FROM SystemLogs 
      WHERE Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY Hour
      ORDER BY Hour
    `;

    const peakHoursResult = await db.prepare(peakHoursQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    // 8. Error Rate Analysis
    const errorRateQuery = `
      SELECT 
        DATE(Timestamp) as Date,
        COUNT(*) as TotalRequests,
        COUNT(CASE WHEN ActivityType LIKE '%error%' OR ActivityType LIKE '%failed%' THEN 1 END) as ErrorCount,
        ROUND((COUNT(CASE WHEN ActivityType LIKE '%error%' OR ActivityType LIKE '%failed%' THEN 1 END) * 100.0) / COUNT(*), 2) as ErrorRate
      FROM SystemLogs 
      WHERE Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY DATE(Timestamp)
      ORDER BY Date DESC
    `;

    const errorRateResult = await db.prepare(errorRateQuery)
      .bind(cutoffDate.toISOString(), ...tenantBindings)
      .all() as any;

    return NextResponse.json({
      success: true,
      data: {
        overview: overviewResult.results || [],
        dailyTrends: dailyTrendsResult.results || [],
        topUsers: topUsersResult.results || [],
        mediaOperations: mediaOperationsResult.results || [],
        authProviders: authProvidersResult.results || [],
        trendAnalysis: trendAnalysisResult.results || [],
        peakHours: peakHoursResult.results || [],
        errorRate: errorRateResult.results || [],
        filters: {
          days,
          tenantIds: tenantIdsParam ? tenantIdsParam.split(',') : null,
          userRole: isAdmin ? 'system_admin' : 'tenant_admin'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

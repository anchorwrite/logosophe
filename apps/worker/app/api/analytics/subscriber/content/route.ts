import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only subscribers can access content analytics
    if (session.user.role !== 'subscriber') {
      return NextResponse.json({ error: 'Forbidden - Subscriber access required' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const language = searchParams.get('language') || 'en';

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get user's accessible tenants
    const userTenantsQuery = `
      SELECT DISTINCT tu.TenantId, t.Name as TenantName
      FROM TenantUsers tu
      LEFT JOIN Tenants t ON tu.TenantId = t.Id
      WHERE tu.Email = ?
    `;

    const userTenantsResult = await db.prepare(userTenantsQuery)
      .bind(session.user.email)
      .all() as any;

    if (!userTenantsResult.results || userTenantsResult.results.length === 0) {
      return NextResponse.json({ error: 'No tenant access found' }, { status: 403 });
    }

    const tenantIds = userTenantsResult.results.map((row: any) => row.TenantId);
    const tenantFilter = `AND TenantId IN (${tenantIds.map(() => '?').join(',')})`;

    // 1. Content Performance - Files with most activity
    const contentPerformanceQuery = `
      SELECT 
        TargetId as MediaId,
        TargetName as FileName,
        ActivityType,
        COUNT(*) as OperationCount,
        COUNT(DISTINCT DATE(Timestamp)) as ActiveDays,
        MIN(Timestamp) as FirstActivity,
        MAX(Timestamp) as LastActivity,
        COALESCE(
          (SELECT json_extract(Metadata, '$.language') 
           FROM SystemLogs sl2 
           WHERE sl2.TargetId = SystemLogs.TargetId 
             AND sl2.LogType = 'media_operations' 
             AND sl2.Metadata IS NOT NULL 
           LIMIT 1), 
          'en'
        ) as ContentLanguage
      FROM SystemLogs 
      WHERE LogType = 'media_operations' 
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY TargetId, TargetName, ActivityType
      ORDER BY OperationCount DESC
      LIMIT 20
    `;

    const contentPerformanceResult = await db.prepare(contentPerformanceQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 2. Weekly Trend Analysis - Daily views with percentage changes
    const weeklyTrendsQuery = `
      WITH daily_views AS (
        SELECT 
          TargetId as MediaId,
          TargetName as FileName,
          DATE(Timestamp) as Date,
          COUNT(*) as DailyViews,
          LAG(COUNT(*), 1) OVER (PARTITION BY TargetId ORDER BY DATE(Timestamp)) as PreviousDayViews
        FROM SystemLogs 
        WHERE LogType = 'media_operations' 
          AND ActivityType = 'view'
          AND Timestamp >= ? 
          AND IsDeleted = 0
          ${tenantFilter}
        GROUP BY TargetId, TargetName, DATE(Timestamp)
      )
      SELECT 
        MediaId,
        FileName,
        Date,
        DailyViews,
        PreviousDayViews,
        CASE 
          WHEN PreviousDayViews = 0 THEN 
            CASE WHEN DailyViews > 0 THEN 100.0 ELSE 0.0 END
          ELSE 
            ROUND(((DailyViews - PreviousDayViews) * 100.0) / PreviousDayViews, 2)
        END as PercentChange
      FROM daily_views
      WHERE Date >= DATE('now', '-7 days')
      ORDER BY Date DESC, DailyViews DESC
    `;

    const weeklyTrendsResult = await db.prepare(weeklyTrendsQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 3. Language Performance - Content performance by language
    const languagePerformanceQuery = `
      SELECT 
        COALESCE(
          json_extract(Metadata, '$.language'), 
          'en'
        ) as ContentLanguage,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT TargetId) as UniqueFiles,
        COUNT(CASE WHEN ActivityType = 'view' THEN 1 END) as Views,
        COUNT(CASE WHEN ActivityType = 'download' THEN 1 END) as Downloads,
        COUNT(CASE WHEN ActivityType = 'upload' THEN 1 END) as Uploads
      FROM SystemLogs 
      WHERE LogType = 'media_operations' 
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY ContentLanguage
      ORDER BY TotalOperations DESC
    `;

    const languagePerformanceResult = await db.prepare(languagePerformanceQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 4. Role Activity - User activity by role
    const roleActivityQuery = `
      SELECT 
        ur.RoleId as UserRole,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT sl.TargetId) as UniqueFiles,
        COUNT(DISTINCT DATE(sl.Timestamp)) as ActiveDays,
        COALESCE(
          (SELECT json_extract(sl2.Metadata, '$.language') 
           FROM SystemLogs sl2 
           WHERE sl2.UserEmail = sl.UserEmail 
             AND sl2.LogType = 'media_operations' 
             AND sl2.Metadata IS NOT NULL 
           LIMIT 1), 
          'en'
        ) as PreferredLanguage
      FROM SystemLogs sl
      JOIN UserRoles ur ON sl.UserEmail = ur.Email AND sl.TenantId = ur.TenantId
      WHERE sl.LogType = 'media_operations' 
        AND sl.Timestamp >= ? 
        AND sl.IsDeleted = 0
        AND sl.TenantId IN (${tenantIds.map(() => '?').join(',')})
      GROUP BY ur.RoleId
      ORDER BY TotalOperations DESC
    `;

    const roleActivityResult = await db.prepare(roleActivityQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 5. Published vs Unpublished Content Performance
    const publishedContentQuery = `
      SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM PublishedContent pc 
            WHERE pc.MediaId = sl.TargetId
          ) THEN 'published' 
          ELSE 'unpublished' 
        END as ContentStatus,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT sl.TargetId) as UniqueFiles,
        COUNT(CASE WHEN sl.ActivityType = 'view' THEN 1 END) as Views,
        COUNT(CASE WHEN sl.ActivityType = 'download' THEN 1 END) as Downloads
      FROM SystemLogs sl
      WHERE sl.LogType = 'media_operations' 
        AND sl.Timestamp >= ? 
        AND sl.IsDeleted = 0
        ${tenantFilter}
      GROUP BY ContentStatus
      ORDER BY TotalOperations DESC
    `;

    const publishedContentResult = await db.prepare(publishedContentQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 6. Content Engagement Trends - Week over Week comparison
    const engagementTrendsQuery = `
      WITH current_week AS (
        SELECT 
          TargetId,
          COUNT(*) as current_views
        FROM SystemLogs 
        WHERE LogType = 'media_operations' 
          AND ActivityType = 'view'
          AND Timestamp >= datetime('now', '-7 days')
          AND IsDeleted = 0
          AND TenantId IN (${tenantIds.map(() => '?').join(',')})
        GROUP BY TargetId
      ),
      previous_week AS (
        SELECT 
          TargetId,
          COUNT(*) as previous_views
        FROM SystemLogs 
        WHERE LogType = 'media_operations' 
          AND ActivityType = 'view'
          AND Timestamp >= datetime('now', '-14 days')
          AND Timestamp < datetime('now', '-7 days')
          AND IsDeleted = 0
          AND TenantId IN (${tenantIds.map(() => '?').join(',')})
        GROUP BY TargetId
      )
      SELECT 
        sl.TargetId as MediaId,
        sl.TargetName as FileName,
        COALESCE(cw.current_views, 0) as current_views,
        COALESCE(pw.previous_views, 0) as previous_views,
        CASE 
          WHEN COALESCE(pw.previous_views, 0) = 0 THEN 
            CASE WHEN COALESCE(cw.current_views, 0) > 0 THEN 100.0 ELSE 0.0 END
          ELSE 
            ROUND(((COALESCE(cw.current_views, 0) - COALESCE(pw.previous_views, 0)) * 100.0) / COALESCE(pw.previous_views, 0), 2)
        END as percent_change
      FROM SystemLogs sl
      LEFT JOIN current_week cw ON sl.TargetId = cw.TargetId
      LEFT JOIN previous_week pw ON sl.TargetId = pw.TargetId
      WHERE sl.LogType = 'media_operations' 
        AND sl.ActivityType = 'view'
        AND sl.Timestamp >= datetime('now', '-7 days')
        AND sl.IsDeleted = 0
        AND sl.TenantId IN (${tenantIds.map(() => '?').join(',')})
      GROUP BY sl.TargetId, sl.TargetName
      ORDER BY current_views DESC
      LIMIT 10
    `;

    const engagementTrendsResult = await db.prepare(engagementTrendsQuery)
      .bind(...tenantIds, ...tenantIds, ...tenantIds)
      .all() as any;

    // 7. Peak Content Hours - When content is most accessed
    const peakHoursQuery = `
      SELECT 
        CAST(strftime('%H', Timestamp) AS INTEGER) as Hour,
        COUNT(*) as ViewCount,
        COUNT(DISTINCT TargetId) as UniqueFiles
      FROM SystemLogs 
      WHERE LogType = 'media_operations' 
        AND ActivityType = 'view'
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY Hour
      ORDER BY Hour
    `;

    const peakHoursResult = await db.prepare(peakHoursQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    // 8. Content Type Performance - Performance by file type
    const contentTypeQuery = `
      SELECT 
        CASE 
          WHEN TargetName LIKE '%.pdf' THEN 'PDF'
          WHEN TargetName LIKE '%.doc%' THEN 'Document'
          WHEN TargetName LIKE '%.jpg%' OR TargetName LIKE '%.png%' OR TargetName LIKE '%.gif%' THEN 'Image'
          WHEN TargetName LIKE '%.mp4%' OR TargetName LIKE '%.avi%' OR TargetName LIKE '%.mov%' THEN 'Video'
          WHEN TargetName LIKE '%.mp3%' OR TargetName LIKE '%.wav%' OR TargetName LIKE '%.aac%' THEN 'Audio'
          ELSE 'Other'
        END as ContentType,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT TargetId) as UniqueFiles,
        COUNT(CASE WHEN ActivityType = 'view' THEN 1 END) as Views,
        COUNT(CASE WHEN ActivityType = 'download' THEN 1 END) as Downloads
      FROM SystemLogs 
      WHERE LogType = 'media_operations' 
        AND Timestamp >= ? 
        AND IsDeleted = 0
        ${tenantFilter}
      GROUP BY ContentType
      ORDER BY TotalOperations DESC
    `;

    const contentTypeResult = await db.prepare(contentTypeQuery)
      .bind(cutoffDate.toISOString(), ...tenantIds)
      .all() as any;

    return NextResponse.json({
      success: true,
      data: {
        contentPerformance: contentPerformanceResult.results || [],
        weeklyTrends: weeklyTrendsResult.results || [],
        languagePerformance: languagePerformanceResult.results || [],
        roleActivity: roleActivityResult.results || [],
        publishedContent: publishedContentResult.results || [],
        engagementTrends: engagementTrendsResult.results || [],
        peakHours: peakHoursResult.results || [],
        contentType: contentTypeResult.results || [],
        filters: {
          days,
          language,
          userTenants: tenantIds,
          userRoles: ['author', 'editor', 'agent', 'reviewer', 'publisher'] // Subscriber roles
        }
      }
    });

  } catch (error) {
    console.error('Error fetching subscriber analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

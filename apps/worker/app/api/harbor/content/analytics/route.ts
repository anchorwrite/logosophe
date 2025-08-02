import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['subscriber', 'publisher', 'admin', 'tenant'],
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get analytics for the current user's published content
    const analytics = await db.prepare(`
      SELECT 
        COUNT(DISTINCT pc.Id) as totalContent,
        COALESCE(SUM(views.view_count), 0) as totalViews,
        COALESCE(SUM(downloads.download_count), 0) as totalDownloads,
        COALESCE(SUM(recent_views.view_count), 0) as recentViews,
        COALESCE(SUM(recent_downloads.download_count), 0) as recentDownloads
      FROM PublishedContent pc
      LEFT JOIN (
        SELECT ContentId, COUNT(*) as view_count
        FROM ContentUsage 
        WHERE UsageType = 'view'
        GROUP BY ContentId
      ) views ON pc.Id = views.ContentId
      LEFT JOIN (
        SELECT ContentId, COUNT(*) as download_count
        FROM ContentUsage 
        WHERE UsageType = 'download'
        GROUP BY ContentId
      ) downloads ON pc.Id = downloads.ContentId
      LEFT JOIN (
        SELECT ContentId, COUNT(*) as view_count
        FROM ContentUsage 
        WHERE UsageType = 'view' 
        AND CreatedAt >= datetime('now', '-7 days')
        GROUP BY ContentId
      ) recent_views ON pc.Id = recent_views.ContentId
      LEFT JOIN (
        SELECT ContentId, COUNT(*) as download_count
        FROM ContentUsage 
        WHERE UsageType = 'download'
        AND CreatedAt >= datetime('now', '-7 days')
        GROUP BY ContentId
      ) recent_downloads ON pc.Id = recent_downloads.ContentId
      WHERE pc.PublisherId = ?
    `).bind(access.email).first();

    return Response.json({
      totalContent: Number(analytics?.totalContent || 0),
      totalViews: Number(analytics?.totalViews || 0),
      totalDownloads: Number(analytics?.totalDownloads || 0),
      recentViews: Number(analytics?.recentViews || 0),
      recentDownloads: Number(analytics?.recentDownloads || 0),
    });
  } catch (error) {
    console.error('Error fetching subscriber analytics:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
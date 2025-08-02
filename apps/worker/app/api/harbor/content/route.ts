import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';

export const runtime = 'edge';

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

    // Get published content for the current user
    const content = await db.prepare(`
      SELECT 
        pc.*,
        mf.FileName,
        mf.FileSize,
        mf.ContentType,
        mf.MediaType,
        mf.Language,
        f.Name as FormName,
        g.Name as GenreName,
        pc.PublisherId as PublisherName,
        COALESCE(views.view_count, 0) as ViewCount,
        COALESCE(downloads.download_count, 0) as DownloadCount
      FROM PublishedContent pc
      INNER JOIN MediaFiles mf ON pc.MediaId = mf.Id
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
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
      WHERE pc.PublisherId = ?
      ORDER BY pc.PublishedAt DESC
    `).bind(access.email).all();

    return Response.json(content.results);
  } catch (error) {
    console.error('Error fetching subscriber content:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
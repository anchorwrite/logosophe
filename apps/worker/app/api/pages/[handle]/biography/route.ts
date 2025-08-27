import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get the active and public biography for this handle
    const biographyResult = await db.prepare(`
      SELECT 
        sb.Id, sb.HandleId, sb.Bio, sb.IsActive, sb.IsPublic, sb.Language,
        sb.CreatedAt, sb.UpdatedAt
      FROM SubscriberBiographies sb
      INNER JOIN SubscriberHandles sh ON sb.HandleId = sh.Id
      WHERE sh.Handle = ? 
        AND sb.IsActive = 1 
        AND sb.IsPublic = 1
      ORDER BY sb.UpdatedAt DESC
      LIMIT 1
    `).bind(handle).first();

    if (!biographyResult) {
      return Response.json({
        success: true,
        data: null
      });
    }

    const biography = biographyResult as any;

    return Response.json({
      success: true,
      data: biography
    });

  } catch (error) {
    console.error('Error fetching biography:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

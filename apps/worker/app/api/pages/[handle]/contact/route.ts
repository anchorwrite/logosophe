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

    // Get the active and public contact info for this handle
    const contactInfoResult = await db.prepare(`
      SELECT 
        sci.Id, sci.HandleId, sci.Email, sci.Phone, sci.Website, sci.Location, 
        sci.SocialLinks, sci.IsActive, sci.IsPublic, sci.Language,
        sci.CreatedAt, sci.UpdatedAt
      FROM SubscriberContactInfo sci
      INNER JOIN SubscriberHandles sh ON sci.HandleId = sh.Id
      WHERE sh.Handle = ? 
        AND sci.IsActive = 1 
        AND sci.IsPublic = 1
      ORDER BY sci.UpdatedAt DESC
      LIMIT 1
    `).bind(handle).first();

    if (!contactInfoResult) {
      return Response.json({
        success: true,
        data: null
      });
    }

    const contactInfo = contactInfoResult as any;

    return Response.json({
      success: true,
      data: contactInfo
    });

  } catch (error) {
    console.error('Error fetching contact info:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

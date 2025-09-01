import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const body = await request.json() as { isActive: boolean };
    const { isActive } = body;

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Verify the biography belongs to this subscriber
    const biographyResult = await db.prepare(`
      SELECT sb.Id, sb.HandleId, sb.IsActive
      FROM SubscriberBiographies sb
      INNER JOIN SubscriberHandles sh ON sb.HandleId = sh.Id
      WHERE sb.Id = ? AND sh.SubscriberEmail = ?
    `).bind(parseInt(id), email).first();

    if (!biographyResult) {
      return Response.json(
        { success: false, error: 'Biography not found or access denied' },
        { status: 404 }
      );
    }

    // Update the biography's active status
    const updateResult = await db.prepare(`
      UPDATE SubscriberBiographies 
      SET IsActive = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      isActive ? 1 : 0,
      new Date().toISOString(),
      parseInt(id)
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating biography:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update biography' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: parseInt(id),
        isActive,
        message: isActive ? 'Biography restored successfully' : 'Biography archived successfully'
      }
    });

  } catch (error) {
    console.error('Error updating biography:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

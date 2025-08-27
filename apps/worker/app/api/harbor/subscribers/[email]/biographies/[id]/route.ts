import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const biographyId = parseInt(id, 10);
    const body = await request.json() as { handleId: number; bio: string; isPublic: boolean; language: string };
    const { handleId, bio, isPublic, language } = body;

    if (!handleId || !bio) {
      return Response.json(
        { success: false, error: 'Handle ID and bio content are required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get existing biography and verify ownership
    const existingBiography = await db.prepare(`
      SELECT sb.*, sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberBiographies sb
      INNER JOIN SubscriberHandles sh ON sb.HandleId = sh.Id
      WHERE sb.Id = ? AND sh.SubscriberEmail = ?
    `).bind(biographyId, email).first();

    if (!existingBiography) {
      return Response.json(
        { success: false, error: 'Biography not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the new handle belongs to this subscriber
    const newHandleResult = await db.prepare(`
      SELECT Id, Handle, DisplayName FROM SubscriberHandles 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(handleId, email).first();

    if (!newHandleResult) {
      return Response.json(
        { success: false, error: 'Handle not found or access denied' },
        { status: 404 }
      );
    }

    // Update the biography
    const updateResult = await db.prepare(`
      UPDATE SubscriberBiographies 
      SET HandleId = ?, Bio = ?, IsPublic = ?, Language = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(
      handleId,
      bio,
      isPublic ? 1 : 0,
      language || 'en',
      new Date().toISOString(),
      biographyId
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating biography:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update biography' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('updated', biographyId.toString(), email, {
      title: 'Biography',
      handleId: (existingBiography as any).HandleId,
      handle: (existingBiography as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        message: 'Biography updated successfully'
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const biographyId = parseInt(id, 10);

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get existing biography and verify ownership
    const existingBiography = await db.prepare(`
      SELECT sb.*, sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberBiographies sb
      INNER JOIN SubscriberHandles sh ON sb.HandleId = sh.Id
      WHERE sb.Id = ? AND sh.SubscriberEmail = ?
    `).bind(biographyId, email).first();

    if (!existingBiography) {
      return Response.json(
        { success: false, error: 'Biography not found or access denied' },
        { status: 404 }
      );
    }

    // Hard delete the biography
    const deleteResult = await db.prepare(`
      DELETE FROM SubscriberBiographies 
      WHERE Id = ?
    `).bind(biographyId).run();

    if (!deleteResult.success) {
      console.error('Database error deleting biography:', deleteResult.error);
      return Response.json(
        { success: false, error: 'Failed to delete biography' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('deleted', biographyId.toString(), email, {
      title: 'Biography',
      handleId: (existingBiography as any).HandleId,
      handle: (existingBiography as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        message: 'Biography deleted successfully'
      }
    });

  } catch (error) {
    console.error('Error deleting biography:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

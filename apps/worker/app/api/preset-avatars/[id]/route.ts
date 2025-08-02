import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


interface UpdateAvatarRequest {
  isActive: boolean;
}

// PATCH /api/preset-avatars/[id] - Update preset avatar status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is admin
    const isAdminUser = await isSystemAdmin(session.user.email, db);
    if (!isAdminUser) {
      return new Response('Unauthorized', { status: 403 });
    }

    const body = await request.json() as UpdateAvatarRequest;
    if (typeof body.isActive !== 'boolean') {
      return new Response('Invalid request body', { status: 400 });
    }

    // Update the avatar status
    const result = await db.prepare(`
      UPDATE UserAvatars 
      SET IsActive = ? 
      WHERE Id = ? AND IsPreset = 1
    `).bind(body.isActive ? 1 : 0, id).run();

    if (result.meta.changes === 0) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Log the status change
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'MAIN_ACCESS',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'update_preset_avatar_status',
      targetId: id,
      targetName: `Preset Avatar ${id}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        isActive: body.isActive,
        tenantId: 'default'
      }
    });

    return Response.json({ 
      success: true,
      message: `Avatar ${body.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating preset avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// DELETE /api/preset-avatars/[id] - Delete a preset avatar
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is admin
    const isAdminUser = await isSystemAdmin(session.user.email, db);
    if (!isAdminUser) {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get the avatar details first
    const avatar = await db.prepare(`
      SELECT R2Key FROM UserAvatars 
      WHERE Id = ? AND IsPreset = 1
    `).bind(id).first() as { R2Key: string } | null;

    if (!avatar) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Delete from R2 storage
          await env.MEDIA_BUCKET.delete(avatar.R2Key);

    // Delete from database
    const result = await db.prepare(`
      DELETE FROM UserAvatars 
      WHERE Id = ? AND IsPreset = 1
    `).bind(id).run();

    if (result.meta.changes === 0) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Log the deletion
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'MAIN_ACCESS',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'delete_preset_avatar',
      targetId: id,
      targetName: `Preset Avatar ${id}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        r2Key: avatar.R2Key,
        tenantId: 'default'
      }
    });

    return Response.json({ 
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting preset avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
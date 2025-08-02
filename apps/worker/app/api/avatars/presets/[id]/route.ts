import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

type Params = Promise<{ id: string }>

interface PresetAvatarUpdate {
  isActive: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
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

    const { id } = await params;
    const data = await request.json() as PresetAvatarUpdate;
    const { isActive } = data;

    console.log('PATCH request:', { id, isActive });

    // Verify the avatar exists and is a preset
    const avatar = await db.prepare(`
      SELECT Id, IsPreset, IsActive
      FROM UserAvatars 
      WHERE Id = ? AND IsPreset = 1
    `).bind(id).first();

    if (!avatar) {
      return new Response('Avatar not found', { status: 404 });
    }

    console.log('Current avatar state:', avatar);

    // Update the avatar status
    const result = await db.prepare(`
      UPDATE UserAvatars 
      SET IsActive = CASE 
          WHEN Id = ? THEN ?
          ELSE 0
        END
      WHERE IsPreset = 1
    `).bind(id, isActive ? 1 : 0).run();

    console.log('Update result:', result);

    if (result.success) {
      // Log the update
      const systemLogs = new SystemLogs(db);
      await systemLogs.createLog({
        logType: 'MAIN_ACCESS',
        timestamp: new Date().toISOString(),
        userEmail: session.user.email,
        accessType: 'update_preset_avatar',
        targetId: id,
        targetName: avatar.R2Key as string,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          avatarId: id,
          isActive,
          r2Key: avatar.R2Key
        }
      });

      // Get the updated avatar to return in the response
      const updatedAvatar = await db.prepare(`
        SELECT Id, IsPreset, IsActive, R2Key
        FROM UserAvatars 
        WHERE Id = ?
      `).bind(id).first();

      return Response.json({ 
        success: true, 
        message: `Avatar ${isActive ? 'activated' : 'deactivated'} successfully`,
        avatar: updatedAvatar
      });
    } else {
      throw new Error('Failed to update avatar status');
    }
  } catch (error) {
    console.error('Error updating avatar status:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
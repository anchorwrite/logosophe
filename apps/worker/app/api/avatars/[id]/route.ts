import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


type Params = Promise<{ id: string }>

export async function DELETE(
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
    const { id } = await params;

    // Get the avatar to check permissions and for logging
    const avatar = await db.prepare(`
      SELECT Id, UserId, IsPreset, R2Key
      FROM UserAvatars 
      WHERE Id = ?
    `).bind(id).first();

    if (!avatar) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Check if user has permission to delete
    const isAdminUser = await isSystemAdmin(session.user.email, db);
    if (!isAdminUser && avatar.UserId !== session.user.id) {
      return new Response('Unauthorized', { status: 403 });
    }

    // Delete the avatar
    const result = await db.prepare(`
      DELETE FROM UserAvatars 
      WHERE Id = ?
    `).bind(id).run();

    if (result.success) {
      // Log the deletion
      const systemLogs = new SystemLogs(db);
      await systemLogs.createLog({
        logType: 'main_access',
        timestamp: new Date().toISOString(),
        userEmail: session.user.email,
        accessType: 'delete_avatar',
        targetId: id,
        targetName: avatar.R2Key as string,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          avatarId: id,
          isPreset: avatar.IsPreset,
          r2Key: avatar.R2Key
        }
      });

      return Response.json({ 
        success: true, 
        message: 'Avatar deleted successfully'
      });
    } else {
      throw new Error('Failed to delete avatar');
    }
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
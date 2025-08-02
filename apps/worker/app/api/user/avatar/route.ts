import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { SystemLogs } from '@/lib/system-logs';


interface AvatarUpdate {
  avatarId: number;
}

// PUT /api/user/avatar - Update user avatar
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const data = await request.json() as AvatarUpdate;

    // Validate input
    if (!data.avatarId) {
      return new Response('Avatar ID is required', { status: 400 });
    }

    // Verify the avatar exists and is either a preset or belongs to the user
    const avatar = await db.prepare(`
      SELECT Id, UserId, R2Key, IsPreset
      FROM UserAvatars 
      WHERE Id = ? AND (IsPreset = 1 OR UserId = ?)
    `).bind(data.avatarId, session.user.id).first();

    if (!avatar) {
      return new Response('Avatar not found or unauthorized', { status: 404 });
    }

    // Update user's active avatar in UserAvatars table
    await db.prepare(`
      UPDATE UserAvatars 
      SET IsActive = CASE WHEN Id = ? THEN 1 ELSE 0 END,
          UpdatedAt = datetime('now')
      WHERE UserId = ?
    `).bind(data.avatarId, session.user.id).run();

    // Update the image field in users table with full URL
    const baseUrl = request.headers.get('origin') || 'https:/local-dev.logosophe.com';
    const imageUrl = `${baseUrl}/api/avatars/${data.avatarId}/preview`;
    await db.prepare(`
      UPDATE users 
      SET image = ?
      WHERE id = ?
    `).bind(imageUrl, session.user.id).run();

    // Log the update
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'MAIN_ACCESS',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'update_avatar',
      targetId: session.user.id,
      targetName: avatar.R2Key as string,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        avatarId: data.avatarId,
        userId: session.user.id,
        imageUrl
      }
    });

    return Response.json({ 
      success: true,
      message: 'Avatar updated successfully'
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// GET /api/user/avatar - Get user's current avatar
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get the user's active avatar
    const avatar = await db.prepare(`
      SELECT Id, R2Key, IsPreset
      FROM UserAvatars 
      WHERE UserId = ? AND IsActive = 1
    `).bind(session.user.id).first();

    if (!avatar) {
      return Response.json({ 
        success: true,
        avatarId: null
      });
    }

    return Response.json({ 
      success: true,
      avatarId: avatar.Id
    });
  } catch (error) {
    console.error('Error fetching current avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
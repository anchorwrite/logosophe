import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { SystemLogs } from '@/lib/system-logs';


interface ProfileUpdate {
  name: string;
  email: string;
}

// PUT /api/user/profile - Update user profile information
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const data = await request.json() as ProfileUpdate;

    // Validate input
    if (!data.name || !data.email) {
      return new Response('Name and email are required', { status: 400 });
    }

    console.log('Profile update request data:', {
      name: data.name,
      email: data.email
    });

    // Get current user data for logging
    const currentUser = await db.prepare(`
      SELECT name, email, image 
      FROM users 
      WHERE id = ?
    `).bind(session.user.id).first();

    if (!currentUser) {
      return new Response('User not found', { status: 404 });
    }

    console.log('Current user data:', currentUser);

    // Update user's profile information
    const result = await db.prepare(`
      UPDATE users 
      SET name = ?, 
          email = ?
      WHERE id = ?
      RETURNING name, email, image
    `).bind(data.name, data.email, session.user.id).run();

    console.log('Update result:', result);

    if (!result.success) {
      throw new Error('Failed to update profile');
    }

    // Log the update
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'main_access',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'update_profile',
      targetId: session.user.id,
      targetName: data.name,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        oldEmail: currentUser.email,
        newEmail: data.email,
        oldName: currentUser.name,
        newName: data.name
      }
    });

    return Response.json({ 
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
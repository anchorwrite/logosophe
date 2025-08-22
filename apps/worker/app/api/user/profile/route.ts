import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { logActivityEvent, extractRequestContext } from '@/lib/logging-utils';


interface ProfileUpdate {
  name: string;
  email: string;
}

// GET /api/user/profile - Get user profile information
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get current user data - check Subscribers table first, then fall back to users table
    let currentUser = await db.prepare(`
      SELECT Name as name, Email as email, NULL as image
      FROM Subscribers 
      WHERE Email = ? AND Active = TRUE
    `).bind(session.user.email).first();

    if (!currentUser) {
      // Fall back to users table if not found in Subscribers
      currentUser = await db.prepare(`
        SELECT name, email, image 
        FROM users 
        WHERE id = ?
      `).bind(session.user.id).first();
    }

    if (!currentUser) {
      return new Response('User not found', { status: 404 });
    }

    return Response.json({
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return new Response('Internal server error', { status: 500 });
  }
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



    // Get current user data for logging
    const currentUser = await db.prepare(`
      SELECT name, email, image 
      FROM users 
      WHERE id = ?
    `).bind(session.user.id).first();

    if (!currentUser) {
      return new Response('User not found', { status: 404 });
    }



    // Update user's profile information
    const result = await db.prepare(`
      UPDATE users 
      SET name = ?, 
          email = ?
      WHERE id = ?
      RETURNING name, email, image
    `).bind(data.name, data.email, session.user.id).run();



    if (!result.success) {
      throw new Error('Failed to update profile');
    }

    // Log the update using standardized logging
    const { ipAddress, userAgent } = extractRequestContext(request);
    await logActivityEvent(db, {
      userEmail: session.user.email,
      activityType: 'update_profile',
      targetId: session.user.id,
      targetName: data.name,
      ipAddress,
      userAgent,
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
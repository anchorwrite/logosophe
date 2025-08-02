import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { SystemLogs } from '@/lib/system-logs';


// POST /api/avatars - Upload custom avatar
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response('No file provided', { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return new Response('Only image files are allowed', { status: 400 });
    }

    // Validate file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return new Response('File size must be less than 5MB', { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Upload to MEDIA_BUCKET
    const buffer = await file.arrayBuffer();
    const r2Key = `avatars/custom/${Date.now()}-${file.name}`;
    
          await env.MEDIA_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user.email,
        isPreset: 'false',
        directory: 'avatars/custom'
      }
    });

    // Insert into UserAvatars
    const result = await db.prepare(`
      INSERT INTO UserAvatars (
        UserId, R2Key, IsPreset, UploadedBy
      ) VALUES (?, ?, ?, ?)
    `).bind(session.user.id, r2Key, false, session.user.email).run();

    const avatarId = result.meta.last_row_id;

    // Log the upload
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'MAIN_ACCESS',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'upload_custom_avatar',
      targetId: avatarId.toString(),
      targetName: file.name,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        isPreset: false,
        fileSize: file.size,
        contentType: file.type,
        userId: session.user.id
      }
    });

    return Response.json({ 
      success: true,
      avatarId,
      r2Key
    });
  } catch (error) {
    console.error('Error uploading custom avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// GET /api/avatars - Get custom avatars for the current user
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get custom avatars for the current user
    const avatars = await db.prepare(`
      SELECT Id, R2Key, IsPreset, UserId
      FROM UserAvatars
      WHERE UserId = ? AND IsPreset = false
      ORDER BY Id DESC
    `).bind(session.user.id).all();

    return Response.json({ 
      success: true,
      avatars: avatars.results
    });
  } catch (error) {
    console.error('Error fetching custom avatars:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
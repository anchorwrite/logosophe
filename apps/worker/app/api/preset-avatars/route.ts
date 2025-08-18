import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


// POST /api/avatars/presets - Admin only endpoint for uploading preset avatars (system-wide)
export async function POST(request: Request) {
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

    // Upload to MEDIA_BUCKET
    const buffer = await file.arrayBuffer();
    const r2Key = `avatars/presets/${Date.now()}-${file.name}`;
    
    await env.MEDIA_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user.email,
        isPreset: 'true',
        directory: 'avatars/presets'
      }
    });

    // Insert into UserAvatars
    const result = await db.prepare(`
      INSERT INTO UserAvatars (
        UserId, R2Key, IsPreset, UploadedBy
      ) VALUES (?, ?, ?, ?)
    `).bind(session.user.id, r2Key, true, session.user.email).run();

    const avatarId = result.meta.last_row_id;

    // Log the upload
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'main_access',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'upload_preset_avatar',
      targetId: avatarId.toString(),
      targetName: file.name,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        isPreset: true,
        fileSize: file.size,
        contentType: file.type,
        tenantId: 'default' // System-wide preset avatars
      }
    });

    return Response.json({ 
      success: true,
      avatarId,
      r2Key
    });
  } catch (error) {
    console.error('Error uploading preset avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// GET /api/avatars/presets - Get list of preset avatars
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get all preset avatars
    const avatars = await db.prepare(`
      SELECT Id, R2Key, IsPreset, IsActive, CreatedAt
      FROM UserAvatars 
      WHERE IsPreset = 1
      ORDER BY CreatedAt DESC
    `).all();

    return Response.json({ 
      success: true,
      avatars: avatars.results 
    });
  } catch (error) {
    console.error('Error listing preset avatars:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user ID from email
    const user = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first() as { id: string } | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete all active sessions for this user
    const result = await db.prepare(
      'DELETE FROM sessions WHERE userId = ? AND expires > datetime("now")'
    ).bind(user.id).run();

    // Log the action
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'user_logout',
      accessType: 'admin',
      targetId: user.id,
      targetName: `User ${email}`,
      ipAddress,
      userAgent,
      metadata: {
        userId: session.user.id || session.user.email,
        provider: 'credentials'
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Logged out user ${email}`,
      sessionsRemoved: result.meta.changes
    });

  } catch (error) {
    console.error('Error logging out user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
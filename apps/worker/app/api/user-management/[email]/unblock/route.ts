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

    // Check if user exists in Subscribers table
    const subscriber = await db.prepare(
              'SELECT Email FROM Subscribers WHERE Email = ? AND Active = TRUE'
    ).bind(email).first() as { Email: string } | null;

    if (!subscriber) {
      return NextResponse.json({ error: 'User not found in subscribers' }, { status: 404 });
    }

    // Unblock the user
    const result = await db.prepare(
      'UPDATE Subscribers SET Banned = 0, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?'
    ).bind(email).run();

    // Log the action
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'user_unblocked',
      accessType: 'admin',
      targetId: email,
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
      message: `Unblocked user ${email}`,
      changes: result.meta.changes
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
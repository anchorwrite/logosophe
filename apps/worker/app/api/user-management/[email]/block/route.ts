import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


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
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await params;

    // Check if user exists in Subscribers table
    const subscriber = await db.prepare(
              'SELECT Email FROM Subscribers WHERE Email = ? AND Active = TRUE'
    ).bind(email).first() as { Email: string } | null;

    if (!subscriber) {
      return NextResponse.json({ error: 'User not found in subscribers' }, { status: 404 });
    }

    // Block the user
    const result = await db.prepare(
      'UPDATE Subscribers SET Banned = 1, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?'
    ).bind(email).run();

    // Log the action
    await systemLogs.logActivity({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      provider: 'credentials',
      activityType: 'user_blocked',
      targetId: email,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({ 
      success: true, 
      message: `Blocked user ${email}`,
      changes: result.meta.changes
    });

  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
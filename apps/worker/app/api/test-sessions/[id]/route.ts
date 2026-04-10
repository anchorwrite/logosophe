import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { headers } from 'next/headers';


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session details before deletion for logging
    const sessionResult = await db.prepare(`
      SELECT SessionToken, TestUserEmail, CreatedBy, CreatedAt
      FROM TestSessions
      WHERE Id = ?
    `).bind(sessionId).first() as any;

    if (!sessionResult) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete the test session
    const result = await db.prepare(`
      DELETE FROM TestSessions
      WHERE Id = ?
    `).bind(sessionId).run();

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to terminate session' }, { status: 500 });
    }

    // Delete the matching BA session row (token = TestSessions.SessionToken)
    const baDeleteResult = await db.prepare(`
      DELETE FROM "session"
      WHERE token = ?
    `).bind(sessionResult.SessionToken).run();

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    const { ipAddress: extractedIp, userAgent: extractedUa } = extractRequestContext(request);
    await normalizedLogging.logTestOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'terminate_test_session',
      accessType: 'delete',
      targetId: sessionResult.SessionToken,
      targetName: sessionResult.TestUserEmail,
      ipAddress: extractedIp,
      userAgent: extractedUa,
      metadata: {
        sessionId,
        testUserEmail: sessionResult.TestUserEmail,
        originalCreatedBy: sessionResult.CreatedBy,
        sessionCreatedAt: sessionResult.CreatedAt,
        baSessionDeleted: baDeleteResult.success,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Session terminated successfully'
    });

  } catch (error) {
    console.error('Error terminating test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

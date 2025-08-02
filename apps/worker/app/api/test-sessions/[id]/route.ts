import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
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
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    const sessionId = parseInt(resolvedParams.id);
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

    // Check if there's an active session for this test user
    const activeSessionResult = await db.prepare(`
      SELECT s.sessionToken, s.userId, u.email
      FROM sessions s 
      JOIN users u ON s.userId = u.id 
      WHERE u.email = ? AND s.expires > datetime('now')
    `).bind(sessionResult.TestUserEmail).first() as any;

    // Delete the test session
    const result = await db.prepare(`
      DELETE FROM TestSessions 
      WHERE Id = ?
    `).bind(sessionId).run();

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to terminate session' }, { status: 500 });
    }

    // If there's an active session, also delete it
    if (activeSessionResult) {
      await db.prepare(`
        DELETE FROM sessions 
        WHERE sessionToken = ?
      `).bind(activeSessionResult.sessionToken).run();
    }

    // Get request headers for logging
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Log the session termination
    await systemLogs.createLog({
      logType: 'TEST_SESSION',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'TERMINATE_TEST_SESSION',
      targetId: sessionResult.SessionToken,
      targetName: sessionResult.TestUserEmail,
      ipAddress,
      userAgent,
      metadata: {
        sessionId,
        testUserEmail: sessionResult.TestUserEmail,
        originalCreatedBy: sessionResult.CreatedBy,
        sessionCreatedAt: sessionResult.CreatedAt,
        activeSessionTerminated: !!activeSessionResult,
        activeSessionToken: activeSessionResult?.sessionToken || null
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
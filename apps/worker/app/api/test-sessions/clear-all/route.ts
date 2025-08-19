import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { headers } from 'next/headers';


export async function DELETE(request: NextRequest) {
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

    // Get all sessions before clearing for logging
    const activeSessionsResult = await db.prepare(`
      SELECT Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt
      FROM TestSessions 
    `).all();

    if (activeSessionsResult.results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions to clear'
      });
    }

    // Get all test user emails to clear their active sessions
    const testUserEmails = activeSessionsResult.results.map((row: any) => row.TestUserEmail);

    // Clear active sessions for these test users
    let activeSessionsCleared = 0;
    for (const email of testUserEmails) {
      const activeSessionResult = await db.prepare(`
        SELECT s.sessionToken
        FROM sessions s 
        JOIN users u ON s.userId = u.id 
        WHERE u.email = ? AND s.expires > datetime('now')
      `).bind(email).first() as any;

      if (activeSessionResult) {
        await db.prepare(`
          DELETE FROM sessions 
          WHERE sessionToken = ?
        `).bind(activeSessionResult.sessionToken).run();
        activeSessionsCleared++;
      }
    }

    // Delete all test sessions
    const result = await db.prepare(`
      DELETE FROM TestSessions 
    `).run();

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to clear sessions' }, { status: 500 });
    }

    // Get request headers for logging
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Log the bulk session termination
    await systemLogs.createLog({
      logType: 'test_session',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
              activityType: 'clear_all_test_sessions',
      targetId: 'bulk-operation',
      targetName: `${activeSessionsResult.results.length} sessions`,
      ipAddress,
      userAgent,
      metadata: {
        sessionsCleared: activeSessionsResult.results.length,
        activeSessionsCleared,
        sessionDetails: activeSessionsResult.results.map((row: any) => ({
          sessionId: row.Id,
          testUserEmail: row.TestUserEmail,
          createdBy: row.CreatedBy,
          createdAt: row.CreatedAt
        }))
      }
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${activeSessionsResult.results.length} sessions`,
      sessionsCleared: activeSessionsResult.results.length
    });

  } catch (error) {
    console.error('Error clearing test sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
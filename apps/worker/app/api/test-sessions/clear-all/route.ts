import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { headers } from 'next/headers';


export async function DELETE(request: NextRequest) {
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

    const activeSessionsResult = await db.prepare(`
      SELECT Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt
      FROM TestSessions
    `).all();

    if (activeSessionsResult.results.length === 0) {
      return NextResponse.json({ success: true, message: 'No sessions to clear' });
    }

    // Delete matching BA session rows
    const tokens = activeSessionsResult.results.map((row: any) => row.SessionToken);
    for (const token of tokens) {
      await db.prepare('DELETE FROM "session" WHERE token = ?').bind(token).run();
    }

    // Delete all test sessions
    const result = await db.prepare('DELETE FROM TestSessions').run();

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to clear sessions' }, { status: 500 });
    }

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    const { ipAddress: extractedIp, userAgent: extractedUa } = extractRequestContext(request);
    await normalizedLogging.logTestOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'clear_all_test_sessions',
      accessType: 'delete',
      targetId: 'bulk-operation',
      targetName: `${activeSessionsResult.results.length} sessions`,
      ipAddress: extractedIp,
      userAgent: extractedUa,
      metadata: {
        sessionsCleared: activeSessionsResult.results.length,
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

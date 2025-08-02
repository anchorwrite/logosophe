import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get session limit from environment variable
    const maxSessions = parseInt(process.env.MAX_CONCURRENT_TEST_SESSIONS || '15');
    
    // Get active sessions count
    const activeSessionsResult = await db.prepare(
      'SELECT COUNT(*) as count FROM TestSessions'
    ).first() as { count: number };

    // Get all sessions with active status
    const sessionsResult = await db.prepare(`
      SELECT 
        Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt, 
        LastAccessed, IpAddress, UserAgent
      FROM TestSessions 
      ORDER BY CreatedAt DESC
    `).all();

    const sessions = await Promise.all(sessionsResult.results.map(async (row: any) => {
      // Check if this test user has an active session in the sessions table
      const activeSessionResult = await db.prepare(`
        SELECT COUNT(*) as isActive 
        FROM sessions s 
        JOIN users u ON s.userId = u.id 
        WHERE u.email = ? AND s.expires > datetime('now')
      `).bind(row.TestUserEmail).first() as { isActive: number };

      return {
        id: row.Id,
        sessionToken: row.SessionToken,
        testUserEmail: row.TestUserEmail,
        createdBy: row.CreatedBy,
        createdAt: row.CreatedAt,
        lastAccessed: row.LastAccessed,
        ipAddress: row.IpAddress,
        userAgent: row.UserAgent,
        sessionUrl: `${process.env.NEXTAUTH_URL || 'https:/www.logosophe.com'}/test-signin?token=${row.SessionToken}`,
        isActive: activeSessionResult.isActive > 0
      };
    }));

    return NextResponse.json({
      success: true,
      sessions,
      sessionCount: activeSessionsResult.count,
      maxSessions
    });

  } catch (error) {
    console.error('Error listing test sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
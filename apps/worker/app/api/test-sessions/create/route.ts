import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { headers } from 'next/headers';


interface CreateSessionRequest {
  testUserEmail: string;
}

export async function POST(request: NextRequest) {
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

    const body = await request.json() as CreateSessionRequest;
    const { testUserEmail } = body;

    if (!testUserEmail || !testUserEmail.includes('@logosophe.test')) {
      return NextResponse.json({ error: 'Invalid test user email' }, { status: 400 });
    }

    // Get session limit from environment variable
    const maxSessions = parseInt(process.env.MAX_CONCURRENT_TEST_SESSIONS || '15');
    
    // Check current active session count
    const activeSessionsResult = await db.prepare(
      'SELECT COUNT(*) as count FROM TestSessions'
    ).first() as { count: number };

    if (activeSessionsResult.count >= maxSessions) {
      return NextResponse.json({ 
        error: `Maximum number of concurrent test sessions (${maxSessions}) reached` 
      }, { status: 429 });
    }

    // Generate secure session token using Web Crypto API
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const sessionToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Get request headers for logging
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Create session in database
    const result = await db.prepare(`
      INSERT INTO TestSessions (
        SessionToken, TestUserEmail, CreatedBy, CreatedAt, 
        IpAddress, UserAgent
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionToken,
      testUserEmail,
      session.user.email,
      new Date().toISOString(),
      ipAddress,
      userAgent
    ).run();

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Log the session creation
    await systemLogs.createLog({
      logType: 'TEST_SESSION',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'CREATE_TEST_SESSION',
      targetId: sessionToken,
      targetName: testUserEmail,
      ipAddress,
      userAgent,
      metadata: {
        testUserEmail,
        sessionToken,
        sessionId: result.meta.last_row_id,
        sessionLimit: maxSessions,
        currentSessionCount: activeSessionsResult.count + 1
      }
    });

    const sessionUrl = `${process.env.NEXTAUTH_URL || 'https:/www.logosophe.com'}/test-signin?token=${sessionToken}`;

    return NextResponse.json({
      success: true,
      sessionToken,
      sessionUrl,
      testUserEmail,
      sessionId: result.meta.last_row_id
    });

  } catch (error) {
    console.error('Error creating test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SystemLogs } from '@/lib/system-logs';
import { headers } from 'next/headers';

export const runtime = 'edge';

interface ValidateTokenRequest {
  token: string;
}

export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    const body = await request.json() as ValidateTokenRequest;
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get request headers for logging
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Validate token and get session details
    const sessionResult = await db.prepare(`
      SELECT Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt, LastAccessed
      FROM TestSessions 
      WHERE SessionToken = ?
    `).bind(token).first() as any;

    if (!sessionResult) {
      // Log failed validation attempt
      await systemLogs.createLog({
        logType: 'TEST_SESSION',
        timestamp: new Date().toISOString(),
        activityType: 'INVALID_TOKEN_ATTEMPT',
        targetId: token,
        targetName: 'invalid-token',
        ipAddress,
        userAgent,
        metadata: {
          token,
          reason: 'token-not-found-or-inactive'
        }
      });

      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Update last accessed timestamp
    await db.prepare(`
      UPDATE TestSessions 
      SET LastAccessed = ? 
      WHERE Id = ?
    `).bind(new Date().toISOString(), sessionResult.Id).run();

    // Log successful token validation
    await systemLogs.createLog({
      logType: 'TEST_SESSION',
      timestamp: new Date().toISOString(),
      userEmail: sessionResult.TestUserEmail,
      activityType: 'VALIDATE_TEST_SESSION_TOKEN',
      targetId: token,
      targetName: sessionResult.TestUserEmail,
      ipAddress,
      userAgent,
      metadata: {
        sessionId: sessionResult.Id,
        testUserEmail: sessionResult.TestUserEmail,
        originalCreatedBy: sessionResult.CreatedBy,
        sessionCreatedAt: sessionResult.CreatedAt,
        previousLastAccessed: sessionResult.LastAccessed
      }
    });

    return NextResponse.json({
      success: true,
      testUserEmail: sessionResult.TestUserEmail,
      sessionId: sessionResult.Id
    });

  } catch (error) {
    console.error('Error validating test session token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
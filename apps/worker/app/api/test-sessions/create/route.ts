import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
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
    const normalizedLogging = new NormalizedLogging(db);

    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as CreateSessionRequest;
    const { testUserEmail } = body;

    if (!testUserEmail || !testUserEmail.includes('@logosophe.test')) {
      return NextResponse.json({ error: 'Invalid test user email' }, { status: 400 });
    }

    const maxSessions = parseInt(process.env.MAX_CONCURRENT_TEST_SESSIONS || '15');

    const activeSessionsResult = await db.prepare(
      'SELECT COUNT(*) as count FROM TestSessions'
    ).first() as { count: number };

    if (activeSessionsResult.count >= maxSessions) {
      return NextResponse.json({
        error: `Maximum number of concurrent test sessions (${maxSessions}) reached`
      }, { status: 429 });
    }

    // Generate secure session token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const sessionToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Insert into TestSessions
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

    // Determine test user number and role
    const match = testUserEmail.match(/test-user-(\d+)@logosophe\.test/);
    if (match) {
      const userNumber = parseInt(match[1], 10);
      const testUserId = `test-user-${userNumber}`;
      const n = userNumber;
      const role = (n >= 301 && n <= 305) || (n >= 410 && n <= 445) ? 'subscriber' : 'user';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Upsert BA user row
      await db.prepare(`
        INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(testUserId, `Test User ${userNumber}`, testUserEmail, role).run();

      // Provision TenantUsers + UserRoles if missing
      const hasTenantRow = await db
        .prepare('SELECT 1 FROM TenantUsers WHERE Email = ?')
        .bind(testUserEmail)
        .first();
      if (!hasTenantRow) {
        await db.prepare(
          "INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
        ).bind(testUserEmail).run();
        try {
          await db.prepare(
            "INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
          ).bind(testUserEmail).run();
        } catch {
          // Ignore FK errors
        }
      }

      // Insert BA session row (token matches TestSessions.SessionToken)
      await db.prepare(`
        INSERT OR REPLACE INTO "session" (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(testUserId, sessionToken, expiresAt, ipAddress, userAgent).run();
    }

    const { ipAddress: extractedIp, userAgent: extractedUa } = extractRequestContext(request);
    await normalizedLogging.logTestOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'create_test_session',
      accessType: 'write',
      targetId: sessionToken,
      targetName: testUserEmail,
      ipAddress: extractedIp,
      userAgent: extractedUa,
      metadata: {
        testUserEmail,
        sessionToken,
        sessionId: result.meta.last_row_id,
        sessionLimit: maxSessions,
        currentSessionCount: activeSessionsResult.count + 1
      }
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://www.logosophe.com';
    const sessionUrl = `${baseUrl}/test-signin?token=${sessionToken}`;

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

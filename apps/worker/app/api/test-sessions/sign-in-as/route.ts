import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  if (!(await isSystemAdmin(session.user.email, db))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { testUserEmail } = (await request.json()) as { testUserEmail: string };
  if (!testUserEmail?.endsWith('@logosophe.test')) {
    return NextResponse.json({ error: 'Invalid test user email' }, { status: 400 });
  }

  const match = testUserEmail.match(/test-user-(\d+)@logosophe\.test/);
  if (!match) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }
  const userNumber = parseInt(match[1], 10);

  const testUserId = `test-user-${userNumber}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');

  // Determine role for test user
  const n = userNumber;
  const role = (n >= 301 && n <= 305) || (n >= 410 && n <= 445) ? 'subscriber' : 'user';

  // Upsert BA user row
  await db
    .prepare(
      `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(testUserId, `Test User ${userNumber}`, testUserEmail, role)
    .run();

  // Provision TenantUsers + UserRoles if missing
  const hasTenantRow = await db
    .prepare('SELECT 1 FROM TenantUsers WHERE Email = ?')
    .bind(testUserEmail)
    .first();
  if (!hasTenantRow) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
      )
      .bind(testUserEmail)
      .run();
    try {
      await db
        .prepare(
          "INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
        )
        .bind(testUserEmail)
        .run();
    } catch {
      // Ignore FK constraint errors
    }
  }

  // Insert BA session row
  await db
    .prepare(
      `INSERT INTO "session" (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, '', 'test-admin-signin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(testUserId, token, expiresAt)
    .run();

  // The client will redirect to /test-signin?token=<token> to exchange for a cookie
  return NextResponse.json({ success: true, token, testUserEmail });
}

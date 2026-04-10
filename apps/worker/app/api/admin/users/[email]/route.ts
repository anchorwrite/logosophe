import { NextResponse } from 'next/server';
import { auth, AuthSession } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { D1Database } from '@cloudflare/workers-types';



type Role = 'admin' | 'tenant';

interface AdminAccess {
  db: D1Database;
  session: NonNullable<AuthSession>;
}

async function checkAdminAccess(): Promise<AdminAccess | { error: string }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: 'Unauthorized' };
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const isAdmin = await isSystemAdmin(session.user.email, db);

  if (!isAdmin) {
    return { error: 'Forbidden' };
  }

  return { db, session };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db, session } = access;

  try {
    const body = await request.json() as { role: Role };
    const { email } = await params;

    if (!body.role || !['admin', 'tenant'].includes(body.role)) {
      return NextResponse.json({ message: 'Role must be either "admin" or "tenant"' }, { status: 400 });
    }

    // Update user role
    const result = await db.prepare(`
      UPDATE Credentials 
      SET Role = ?, UpdatedAt = datetime('now')
      WHERE Email = ?
      RETURNING *
    `).bind(body.role, email).first();

    if (!result) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Log the activity
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email || '',
      tenantId: 'system',
      activityType: 'update_admin_user',
      accessType: 'admin',
      targetId: email,
      targetName: `Admin User ${email}`,
      ipAddress,
      userAgent,
      metadata: { targetEmail: email, newRole: body.role }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating admin user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db, session } = access;

  try {
    const { email } = await params;

    // Check if user exists in BA user table
    const user = await db.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();

    if (user) {
      // Delete related records first to handle foreign key constraints

      // Better Auth tables
      await db.prepare('DELETE FROM "account" WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM "session" WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM "verification" WHERE identifier = ?').bind(email).run();

      // App tables
      await db.prepare('DELETE FROM UserAvatars WHERE UserId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM UserRoles WHERE Email = ?').bind(email).run();
      await db.prepare('DELETE FROM Preferences WHERE Email = ?').bind(email).run();
      await db.prepare('DELETE FROM TenantUsers WHERE Email = ?').bind(email).run();

      // Note: SystemLogs are intentionally NOT deleted to preserve audit trail

      await db.prepare('DELETE FROM "user" WHERE id = ?').bind(user.id).run();
    }

    // Delete from Credentials table
    const result = await db.prepare('DELETE FROM Credentials WHERE Email = ?')
      .bind(email)
      .run();

    if (result.meta.changes === 0 && !user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Log the activity
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email || '',
      tenantId: 'system',
      activityType: 'delete_admin_user',
      accessType: 'admin',
      targetId: email,
      targetName: `Admin User ${email}`,
      ipAddress,
      userAgent,
      metadata: { targetEmail: email }
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 
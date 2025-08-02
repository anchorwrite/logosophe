import { NextResponse } from 'next/server';
import { auth, createCustomAdapter } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { D1Database } from '@cloudflare/workers-types';
import type { Session } from 'next-auth';



type Role = 'admin' | 'tenant';

interface AdminAccess {
  db: D1Database;
  session: Session;
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
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'ACTIVITY',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email || '',
      activityType: 'UPDATE_ADMIN_USER',
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

    // Check if user exists in Users table
    const customAdapter = await createCustomAdapter();
    const user = await customAdapter?.getUserByEmail?.(email);
    
    if (user) {
      // Delete related records first to handle foreign key constraints
      
      // Delete from accounts table (AuthJS)
      await db.prepare('DELETE FROM accounts WHERE userId = ?')
        .bind(user.id)
        .run();

      // Delete from sessions table (AuthJS)
      await db.prepare('DELETE FROM sessions WHERE userId = ?')
        .bind(user.id)
        .run();

      // Delete from verification_tokens table (AuthJS)
      await db.prepare('DELETE FROM verification_tokens WHERE identifier = ?')
        .bind(email)
        .run();

      // Delete from UserAvatars
      await db.prepare('DELETE FROM UserAvatars WHERE UserId = ?')
        .bind(user.id)
        .run();

      // Delete from UserRoles
      await db.prepare('DELETE FROM UserRoles WHERE Email = ?')
        .bind(email)
        .run();

      // Delete from TenantUsers
      await db.prepare('DELETE FROM TenantUsers WHERE Email = ?')
        .bind(email)
        .run();

      // Note: SystemLogs are intentionally NOT deleted to preserve audit trail
      // SystemLogs records will remain for historical purposes

      // Now delete from Users table using the adapter
      await customAdapter?.deleteUser?.(user.id);
    }

    // Delete from Credentials table
    const result = await db.prepare('DELETE FROM Credentials WHERE Email = ?')
      .bind(email)
      .run();

    if (result.meta.changes === 0 && !user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Log the activity
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'ACTIVITY',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email || '',
      activityType: 'DELETE_ADMIN_USER',
      metadata: { targetEmail: email }
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 
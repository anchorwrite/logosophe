import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { D1Database } from '@cloudflare/workers-types';
import type { Session } from 'next-auth';

export const runtime = 'edge';

type Role = 'admin' | 'tenant';

interface AdminAccess {
  db: D1Database;
  session: Session;
}

interface CreateAdminUserRequest {
  email: string;
  role: Role;
  password: string;
  tenantIds?: string[];
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

export async function POST(request: Request) {
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db, session } = access;

  try {
    const body = await request.json() as CreateAdminUserRequest;

    if (!body.email || !body.role || !['admin', 'tenant'].includes(body.role) || !body.password) {
      return NextResponse.json({ message: 'Email, role (admin/tenant), and password are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.prepare('SELECT * FROM Credentials WHERE Email = ?')
      .bind(body.email)
      .first();

    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    // Create new user
    const result = await db.prepare(`
      INSERT INTO Credentials (Email, Password, Role, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `).bind(body.email, body.password, body.role).first();

    // If this is a tenant admin and tenant assignments are provided, create the assignments
    if (body.role === 'tenant' && body.tenantIds && body.tenantIds.length > 0) {
      // Validate that all tenant IDs exist
      const placeholders = body.tenantIds.map(() => '?').join(',');
      const existingTenants = await db.prepare(`
        SELECT Id FROM Tenants WHERE Id IN (${placeholders})
      `).bind(...body.tenantIds).all();

      if (existingTenants.results?.length !== body.tenantIds.length) {
        return NextResponse.json({ message: 'One or more tenant IDs are invalid' }, { status: 400 });
      }

      // Add tenant assignments
      for (const tenantId of body.tenantIds) {
        // Add to TenantUsers with 'tenant' role
        await db.prepare(`
          INSERT INTO TenantUsers (TenantId, Email, RoleId)
          VALUES (?, ?, 'tenant')
        `).bind(tenantId, body.email).run();

        // Add to UserRoles
        await db.prepare(`
          INSERT INTO UserRoles (TenantId, Email, RoleId)
          VALUES (?, ?, 'tenant')
        `).bind(tenantId, body.email).run();
      }
    }

    // Log the activity
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
      logType: 'ACTIVITY',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email || '',
      activityType: 'CREATE_ADMIN_USER',
      metadata: { 
        targetEmail: body.email, 
        role: body.role,
        tenantIds: body.tenantIds || []
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db } = access;

  try {
    const users = await db.prepare('SELECT * FROM Credentials ORDER BY CreatedAt DESC').all();
    return NextResponse.json(users.results);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 
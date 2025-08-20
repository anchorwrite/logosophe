import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import bcrypt from 'bcryptjs';
import { SystemLogs } from '@/lib/system-logs';
import { isSystemAdmin } from '@/lib/access';


interface CredentialsUser {
  Email: string;
  Password: string;
  Role: string;
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;

  try {
    // Check if user is admin or tenant admin
    const isAdminUser = await isSystemAdmin(session.user.email, db);
    if (!isAdminUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json() as { 
      currentPassword: string;
      newPassword: string;
    };

    // Validate input
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json({ message: 'Current password and new password are required' }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json({ message: 'New password must be at least 8 characters long' }, { status: 400 });
    }

    // Get user from Credentials table using direct SQL query
    const user = await db.prepare(`
      SELECT Email, Password, Role 
      FROM Credentials 
      WHERE Email = ?
    `).bind(session.user.email).first<CredentialsUser>();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValid = bcrypt.compareSync(body.currentPassword, user.Password);
    if (!isValid) {
      return NextResponse.json({ message: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(body.newPassword, salt);

    // Update password using direct SQL query
    await db.prepare(`
      UPDATE Credentials 
      SET Password = ?, UpdatedAt = datetime('now')
      WHERE Email = ?
    `).bind(hashedPassword, session.user.email).run();

    // Log the activity with all required fields
    const systemLogs = new SystemLogs(db);
    await systemLogs.createLog({
                  logType: 'authentication',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      accessType: 'CHANGE_PASSWORD',
      targetId: session.user.email,
      targetName: 'User Password',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { 
        email: session.user.email,
        role: user.Role
      }
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { checkAccess } from "@/lib/access-control";
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { getDB } from '@/lib/request-context';


interface UpdateRoleRequest {
  RoleId: string;
}

type Params = Promise<{ id: string; email: string }>

// PUT /api/tenant/[id]/users/[email] - Update user role
export async function PUT(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const { id, email } = await params;

    // Only admins can update user roles
    if (!await isSystemAdmin(session.user.email, db)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as UpdateRoleRequest;
    const { RoleId } = body;

    if (!RoleId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get role name for activity logging
    const roleNameResult = await db.prepare(`
      SELECT Name FROM Roles WHERE Id = ?
    `).bind(RoleId).first();
    
    const roleName = (roleNameResult?.Name as string) || 'unknown';

    // Update user role
    await db.prepare(`
      UPDATE TenantUsers 
      SET RoleId = ?
      WHERE TenantId = ? AND Email = ?
    `).bind(RoleId, id, email).run();

    // Log activity
    await db.prepare(`
      INSERT INTO SystemLogs (
        LogType, Timestamp, UserEmail, TenantId, ActivityType,
        TargetId, TargetName, IpAddress, UserAgent, Metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'ACTIVITY',
      new Date().toISOString(),
      session.user.email,
      id,
      'UPDATE_ROLE',
      email,
      `${email}_${roleName.toLowerCase().replace(/\s+/g, '_')}`,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      request.headers.get('user-agent') || null,
      JSON.stringify({ role: roleName })
    ).run();

    return NextResponse.json({
      success: true,
      message: "User role updated successfully"
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/tenant/[id]/users/[email] - Remove user from tenant
export async function DELETE(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const { id, email } = await params;

    // Only admins can remove users
    if (!await isSystemAdmin(session.user.email, db)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's current role for logging
    const userRoleResult = await db.prepare(`
      SELECT r.Name as RoleName
      FROM TenantUsers tu
      JOIN Roles r ON tu.RoleId = r.Id
      WHERE tu.TenantId = ? AND tu.Email = ?
    `).bind(id, email).first();
    
    const roleName = (userRoleResult?.RoleName as string) || 'unknown';

    // Remove user from tenant
    await db.prepare(`
      DELETE FROM TenantUsers 
      WHERE TenantId = ? AND Email = ?
    `).bind(id, email).run();

    // Also remove all roles from UserRoles
    await db.prepare(`
      DELETE FROM UserRoles 
      WHERE TenantId = ? AND Email = ?
    `).bind(id, email).run();

    // Log activity
    await db.prepare(`
      INSERT INTO SystemLogs (
        LogType, Timestamp, UserEmail, TenantId, ActivityType,
        TargetId, TargetName, IpAddress, UserAgent, Metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'ACTIVITY',
      new Date().toISOString(),
      session.user.email,
      id,
      'REMOVE_USER',
      email,
      email,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      request.headers.get('user-agent') || null,
      JSON.stringify({ role: roleName })
    ).run();

    return NextResponse.json({
      success: true,
      message: "User removed from tenant successfully"
    });
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
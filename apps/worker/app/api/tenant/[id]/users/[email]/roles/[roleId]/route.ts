import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getDB } from '@/lib/request-context';

export const runtime = 'edge';

type Params = Promise<{ id: string; email: string; roleId: string }>

// DELETE /api/tenant/[id]/users/[email]/roles/[roleId] - Remove role from user
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
    const { id, email, roleId } = await params;

    // Check if user is either a system admin or a tenant admin for this tenant
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = await isTenantAdminFor(session.user.email, id);
    
    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get role name for activity logging
    const roleNameResult = await db.prepare(`
      SELECT Name FROM Roles WHERE Id = ?
    `).bind(roleId).first();
    
    const roleName = (roleNameResult?.Name as string) || 'unknown';

    // Remove role from user
    await db.prepare(`
      DELETE FROM UserRoles 
      WHERE TenantId = ? AND Email = ? AND RoleId = ?
    `).bind(id, email, roleId).run();

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
      'REMOVE_ROLE',
      email,
      `${email}_${roleName.toLowerCase().replace(/\s+/g, '_')}`,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      request.headers.get('user-agent') || null,
      JSON.stringify({ role: roleName })
    ).run();

    return NextResponse.json({
      success: true,
      message: "User role removed successfully"
    });
  } catch (error) {
    console.error('Error removing user role:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
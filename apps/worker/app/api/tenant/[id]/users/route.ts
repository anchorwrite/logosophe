import { NextResponse } from 'next/server';
import { checkAccess } from "@/lib/access-control";
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getDB } from '@/lib/request-context';
import { v4 as uuid } from 'uuid';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

interface TenantUserRequest {
  Email: string;
  RoleId: string;
}

type Params = Promise<{ id: string }>

// GET /api/tenant/[id]/users - List tenant users
export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess) {
      return NextResponse.json({ 
        error: "Unauthorized",
        message: "You do not have permission to view tenant users. Only system administrators and tenant administrators can access this resource."
      }, { status: 403 });
    }

    const db = await getDB();
    const { id } = await params;

    const result = await db.prepare(`
      SELECT 
        ur.Email,
        s.Name as UserName,
        ur.RoleId,
        r.Name as RoleName
      FROM UserRoles ur
      JOIN Subscribers s ON ur.Email = s.Email
      JOIN Roles r ON ur.RoleId = r.Id
      WHERE ur.TenantId = ?
      ORDER BY s.Name ASC
    `).bind(id).all();

    return NextResponse.json({ results: result.results });
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      message: "An unexpected error occurred while fetching tenant users."
    }, { status: 500 });
  }
}

// POST /api/tenant/[id]/users - Add user to tenant
export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { Email, RoleId } = await request.json() as TenantUserRequest;

    if (!Email || !RoleId) {
      return NextResponse.json({ 
        error: "Bad Request",
        message: "Email and RoleId are required."
      }, { status: 400 });
    }

    const db = await getDB();
    const systemLogs = new SystemLogs(db);

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);

    // For non-admin users, verify they have access to the tenant
    if (!isAdmin) {
      const tenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers 
        WHERE Email = ? AND TenantId = ?
      `).bind(session.user.email, id).first();

      if (!tenantAccess) {
        return NextResponse.json({ 
          error: "Forbidden",
          message: "You do not have access to this tenant."
        }, { status: 403 });
      }
    }

    // Check if the target user is a credentials user
    const isCredentialsUser = await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ?
    `).bind(Email).first();

    // First ensure user exists in TenantUsers with appropriate role
    const existingTenantUser = await db.prepare(`
      SELECT 1 FROM TenantUsers 
      WHERE TenantId = ? AND Email = ?
    `).bind(id, Email).first();

    if (!existingTenantUser) {
      // Add user to TenantUsers with 'user' role
      const result = await db.prepare(`
        INSERT INTO TenantUsers (TenantId, Email, RoleId)
        VALUES (?, ?, ?)
      `).bind(id, Email, 'user').run();

      if (!result.success) {
        return NextResponse.json({ 
          error: "Database Error",
          message: "Failed to add user to tenant."
        }, { status: 500 });
      }

      // Add 'user' role to UserRoles
      const userRoleResult = await db.prepare(`
        INSERT INTO UserRoles (TenantId, Email, RoleId)
        VALUES (?, ?, ?)
      `).bind(id, Email, 'user').run();

      if (!userRoleResult.success) {
        return NextResponse.json({ 
          error: "Database Error",
          message: "Failed to add user role."
        }, { status: 500 });
      }

      // Log first-time tenant user addition
      await systemLogs.logUserOperation({
        userEmail: session.user.email,
        activityType: 'TENANT_ADD_USER',
        targetId: Email,
        targetName: Email,
        tenantId: id,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { action: 'add_user_to_tenant' }
      });

      // Verify the user was added successfully
      const verifyUser = await db.prepare(`
        SELECT 1 FROM TenantUsers 
        WHERE TenantId = ? AND Email = ?
      `).bind(id, Email).first();

      if (!verifyUser) {
        return NextResponse.json({ 
          error: "Database Error",
          message: "Failed to verify user was added to tenant."
        }, { status: 500 });
      }
    }

    // Verify role exists
    const roleExists = await db.prepare(`
      SELECT 1 FROM Roles WHERE Id = ?
    `).bind(RoleId).first();

    if (!roleExists) {
      return NextResponse.json({ 
        error: "Bad Request",
        message: "Invalid role ID."
      }, { status: 400 });
    }

    // Add user role to UserRoles if it doesn't already exist
    const existingRole = await db.prepare(`
      SELECT 1 FROM UserRoles 
      WHERE TenantId = ? AND Email = ? AND RoleId = ?
    `).bind(id, Email, RoleId).first();

    if (existingRole) {
      return NextResponse.json({ 
        error: "Bad Request",
        message: "User already has this role in this tenant."
      }, { status: 400 });
    }

    // Add the role
    const roleResult = await db.prepare(`
      INSERT INTO UserRoles (TenantId, Email, RoleId)
      VALUES (?, ?, ?)
    `).bind(id, Email, RoleId).run();

    if (!roleResult.success) {
      return NextResponse.json({ 
        error: "Database Error",
        message: "Failed to add role to user."
      }, { status: 500 });
    }

    // Get role name for activity logging
    const roleNameResult = await db.prepare(`
      SELECT Name FROM Roles WHERE Id = ?
    `).bind(RoleId).first();
    
    const roleName = (roleNameResult?.Name as string) || 'unknown';

    // Log role addition
    await systemLogs.logUserOperation({
      userEmail: session.user.email,
      activityType: 'ADD_ROLE',
      targetId: Email,
      targetName: `${Email}_${roleName.toLowerCase().replace(/\s+/g, '_')}`,
      tenantId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { role: roleName }
    });

    return NextResponse.json({
      success: true,
      message: "User added to tenant successfully"
    });
  } catch (error) {
    console.error('Error adding user to tenant:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      message: "An unexpected error occurred while adding the user to the tenant."
    }, { status: 500 });
  }
} 
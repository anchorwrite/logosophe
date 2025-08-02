import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { getRequestContext as getRequestContextLib } from '@/lib/request-context';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

interface TenantCreateRequest {
  id: string;
  name: string;
  description?: string;
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is a system admin
    const isAdmin = access.email ? await isSystemAdmin(access.email, db) : false;

    let result;
    if (isAdmin) {
      // System admins see all tenants
      result = await db.prepare(`
        SELECT Id, Name, Description, CreatedAt, UpdatedAt
        FROM Tenants
        ORDER BY Name ASC
      `).all();
    } else {
      // Tenant users see only their assigned tenants
      result = await db.prepare(`
        SELECT t.Id, t.Name, t.Description, t.CreatedAt, t.UpdatedAt
        FROM Tenants t
        JOIN TenantUsers tu ON t.Id = tu.TenantId
        WHERE tu.Email = ?
        ORDER BY t.Name ASC
      `).bind(access.email).all();
    }

    return Response.json({ results: result.results });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  if (!await isSystemAdmin(session.user.email, env.DB)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { id, name, description } = await request.json() as TenantCreateRequest;

    if (!id || !name) {
      return new NextResponse('Id and name are required', { status: 400 });
    }

    // Check if tenant with this ID already exists
    const existingTenant = await env.DB.prepare(`
      SELECT Id FROM Tenants WHERE Id = ?
    `).bind(id).first();

    if (existingTenant) {
      return new NextResponse('A tenant with this ID already exists', { status: 409 });
    }

    // Create tenant with provided ID
    const result = await env.DB.prepare(`
      INSERT INTO Tenants (Id, Name, Description, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      RETURNING Id
    `)
    .bind(id, name, description)
    .first();

    if (!result?.Id) {
      throw new Error('Failed to create tenant');
    }

    // Log the activity using SystemLogs
    const systemLogs = new SystemLogs(env.DB);
    await systemLogs.logTenantOperation({
      userEmail: session.user.email,
      activityType: 'CREATE_TENANT',
      targetId: id,
      targetName: name,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        email: session.user.email,
        tenantId: id,
        tenantName: name,
        provider: 'credentials',
        userId: session.user.id
      }
    });

    return new NextResponse(JSON.stringify({ id: result.Id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 
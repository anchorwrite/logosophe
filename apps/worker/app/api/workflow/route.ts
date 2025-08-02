export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to create workflows' }, { status: 403 });
    }

    const body = await request.json() as {
      title: string;
      description: string;
      tenantId: string;
      initiatorRole: string;
      participants: Array<{ email: string; role: string }>;
      mediaFileIds: number[];
    };
    const { title, description, tenantId, initiatorRole, participants, mediaFileIds } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    if (!initiatorRole) {
      return NextResponse.json({ error: 'Initiator role is required' }, { status: 400 });
    }

    // Check if user has the selected role in the selected tenant
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    
    // Check if user is system admin (can create workflows in any tenant)
    const isSystemAdmin = await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'admin'
    `).bind(access.email).first();
    
    if (!isSystemAdmin) {
      // Check if user has the selected role in the selected tenant
      const userRoleInTenant = await db.prepare(`
        SELECT ur.RoleId, r.Name as RoleName
        FROM UserRoles ur
        JOIN Roles r ON ur.RoleId = r.Id
        WHERE ur.Email = ? AND ur.TenantId = ?
      `).bind(access.email, tenantId).first() as { RoleId: string; RoleName: string } | null;
      
      if (!userRoleInTenant) {
        return NextResponse.json({ 
          error: 'You do not have the selected role in the selected tenant' 
        }, { status: 403 });
      }
      
      // Verify the selected role matches one of the user's roles in this tenant
      if (userRoleInTenant.RoleId !== initiatorRole) {
        return NextResponse.json({ 
          error: 'You do not have the selected role in the selected tenant' 
        }, { status: 403 });
      }
      
      // Check that the initiator role is one of the allowed roles for workflow creation
      const allowedWorkflowRoles = ['author', 'editor', 'agent', 'reviewer'];
      if (!allowedWorkflowRoles.includes(initiatorRole)) {
        return NextResponse.json({ 
          error: 'Only users with author, editor, agent, or reviewer roles can create workflows' 
        }, { status: 403 });
      }
    }

    // Forward the request to the worker
    const workerResponse = await fetch(`${WORKER_URL}/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access.email}`,
      },
      body: JSON.stringify({
        tenantId,
        title,
        description,
        initiatorRole,
        participants,
        mediaFileIds
      }),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflows' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Forward the request to the worker
    const workerUrl = `${WORKER_URL}/workflow?tenantId=${tenantId}${status ? `&status=${status}` : ''}`;
    console.log('Making request to worker:', workerUrl);
    
    const workerResponse = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access.email}`,
      },
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session directly as backup to ensure we have the email
    const session = await auth();
    const userEmail = access.email || session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forward the request to the worker with the correct parameters
    const workerResponse = await fetch(`${WORKER_URL}/workflow/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userEmail}`,
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Use the same access control pattern as tenant members page
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      console.log('PUT /api/workflow/[id]: Access denied');
      return NextResponse.json({ error: 'You do not have permission to complete workflows' }, { status: 403 });
    }

    // Get session directly as backup to ensure we have the email
    const session = await auth();
    const userEmail = access.email || session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { status: string; completedBy?: string };

    // Get tenant ID from the request
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    console.log('PUT /api/workflow/[id]: Debug info:', {
      workflowId: id,
      userEmail,
      tenantId,
      status: body.status,
      completedBy: body.completedBy
    });

    if (!tenantId) {
      console.log('PUT /api/workflow/[id]: Missing tenantId');
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Forward the request to the worker
    const workerResponse = await fetch(`${WORKER_URL}/workflow/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userEmail}`,
      },
      body: JSON.stringify(body),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      console.log('PUT /api/workflow/[id]: Worker error:', error);
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    console.log('PUT /api/workflow/[id]: Success');
    return NextResponse.json(result);

  } catch (error) {
    console.error('PUT /api/workflow/[id]: Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
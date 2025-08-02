import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow history' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Forward the request to the worker
    const workerUrl = `${WORKER_URL}/workflow/history?tenantId=${tenantId}&userEmail=${encodeURIComponent(access.email)}`;
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
    console.error('Workflow history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
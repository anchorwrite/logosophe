import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to list workflows' }, { status: 403 });
    }

    // Forward request to worker
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

    const workerResponse = await fetch(`${WORKER_URL}/workflow`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Workflow list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow status' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Forward request to worker
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

    const workerResponse = await fetch(`${WORKER_URL}/workflow?workflowId=${workflowId}`, {
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
    console.error('Workflow status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow messages' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Forward request to worker
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const { searchParams: urlSearchParams } = new URL(request.url);
    const tenantId = urlSearchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const workerResponse = await fetch(`${WORKER_URL}/workflow/messages?tenantId=${tenantId}&workflowId=${workflowId}`, {
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
    console.error('Workflow messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to send workflow messages' }, { status: 403 });
    }

    const body = await request.json() as {
      workflowId: string;
      message: string;
      senderEmail: string;
    };

    if (!body.workflowId || !body.message || !body.senderEmail) {
      return NextResponse.json({ error: 'Workflow ID, message, and sender email are required' }, { status: 400 });
    }

    // Forward request to worker
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';
    const { searchParams: urlSearchParams } = new URL(request.url);
    const tenantId = urlSearchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const workerResponse = await fetch(`${WORKER_URL}/workflow/messages?tenantId=${tenantId}&workflowId=${body.workflowId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId: body.workflowId,
        senderEmail: body.senderEmail,
        messageType: 'response',
        content: body.message
      }),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Workflow messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';


export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to initiate workflows' }, { status: 403 });
    }

    const body = await request.json() as {
      tenantId: string;
      initiatorEmail: string;
      mediaFileId: number;
      workflowType: 'editor' | 'agent' | 'reviewer';
      participants: string[];
    };
    
    // Get the Durable Object for this tenant
    const tenantId = body.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Forward request to worker
    const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

    const workerResponse = await fetch(`${WORKER_URL}/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      return NextResponse.json({ error: `Worker error: ${error}` }, { status: workerResponse.status });
    }

    const result = await workerResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Workflow initiate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';


const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

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
      senderEmail: string;
      tenantId: string;
      messageType?: 'request' | 'response' | 'upload' | 'share_link' | 'review';
      content: string;
      mediaFileId?: number;
      shareToken?: string;
    };
    
    if (!body.workflowId || !body.senderEmail || !body.content || !body.tenantId) {
      return NextResponse.json({ error: 'Workflow ID, sender email, content, and tenant ID are required' }, { status: 400 });
    }

    // Forward request to worker
    const workerResponse = await fetch(`${WORKER_URL}/workflow/messages?tenantId=${body.tenantId}&workflowId=${body.workflowId}`, {
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
    console.error('Workflow send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
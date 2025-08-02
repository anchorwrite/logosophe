import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to clear notifications' },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      workflowId: string;
      lastViewedTimestamp: string;
    };

    const { workflowId, lastViewedTimestamp } = body;

    if (!workflowId || !lastViewedTimestamp) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: workflowId and lastViewedTimestamp' },
        { status: 400 }
      );
    }

    // Call the worker to clear notifications (worker will handle workflow access check)
    const workerResponse = await fetch(`${WORKER_URL}/notifications/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: access.email,
        workflowId,
        lastViewedTimestamp
      }),
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('Worker response error:', errorText);
      return NextResponse.json(
        { success: false, error: `Worker error: ${workerResponse.status}` },
        { status: workerResponse.status }
      );
    }

    const data = await workerResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in clear notifications API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
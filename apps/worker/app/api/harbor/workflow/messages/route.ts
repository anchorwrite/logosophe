import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const workflowId = searchParams.get('workflowId');

    if (!tenantId || !workflowId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: tenantId and workflowId' },
        { status: 400 }
      );
    }

    const requestData = await request.json();

    const workerResponse = await fetch(`${WORKER_URL}/workflow/messages?tenantId=${tenantId}&workflowId=${workflowId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
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
    console.error('Error in workflow messages API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';


const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to check notifications' },
        { status: 403 }
      );
    }

    // Call the worker to check notifications
    const workerResponse = await fetch(`${WORKER_URL}/notifications/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: access.email
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
    console.error('Error in check notifications API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
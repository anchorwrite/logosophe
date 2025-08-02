import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view workflow statistics' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userEmail = access.email; // Use email from session instead of query param

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: tenantId' },
        { status: 400 }
      );
    }

    // Verify the user has access to this tenant
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    
    const userTenantCheck = await db.prepare(`
      SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
    `).bind(userEmail, tenantId).first();

    if (!userTenantCheck) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this tenant' },
        { status: 403 }
      );
    }

    const workerResponse = await fetch(`${WORKER_URL}/workflow/stats?tenantId=${tenantId}&userEmail=${userEmail}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userEmail}`,
        'Content-Type': 'application/json',
      },
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
    console.error('Error in workflow stats API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
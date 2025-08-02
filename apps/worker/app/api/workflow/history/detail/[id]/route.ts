import { NextRequest } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('Workflow history detail API called');
  try {
    const { id } = await params;
    console.log('Workflow ID:', id);
    
    if (!id) {
      return Response.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const userEmail = authHeader.replace('Bearer ', '');

    if (!userEmail) {
      return Response.json({ error: 'Authorization required' }, { status: 401 });
    }

    // Get tenant ID from user's session
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const userTenantQuery = `
      SELECT tu.TenantId
      FROM TenantUsers tu
      WHERE tu.Email = ?
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(userEmail)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return Response.json({ error: 'User not associated with any tenant' }, { status: 400 });
    }

    const tenantId = userTenantResult.TenantId;

    // Proxy the request to the worker
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

    console.log('Calling worker URL:', `${workerUrl}/workflow/history/detail/${id}?tenantId=${tenantId}&userEmail=${userEmail}`);
    const response = await fetch(`${workerUrl}/workflow/history/detail/${id}?tenantId=${tenantId}&userEmail=${userEmail}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userEmail}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('Worker response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      return Response.json(
        { error: errorData.error || 'Failed to fetch workflow history detail' }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Error in workflow history detail API:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
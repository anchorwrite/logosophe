import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to list workflows' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user has access to this tenant
    const userTenantCheck = await db.prepare(`
      SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
    `).bind(access.email, tenantId).first();

    if (!userTenantCheck) {
      return NextResponse.json(
        { error: 'You do not have access to this tenant' },
        { status: 403 }
      );
    }

    // Build the query with optional status filter
    let workflowsQuery = `
      SELECT 
        w.Id,
        w.Title,
        w.Status,
        w.CreatedAt,
        w.CompletedAt,
        w.CompletedBy,
        COUNT(wm.Id) as messageCount,
        MAX(wm.CreatedAt) as lastActivity,
        COUNT(DISTINCT wp.ParticipantEmail) as participantCount
      FROM Workflows w
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.TenantId = ?
        AND EXISTS (
          SELECT 1 FROM WorkflowParticipants wp2 
          WHERE wp2.WorkflowId = w.Id AND wp2.ParticipantEmail = ?
        )
    `;

    const queryParams = [tenantId, access.email];

    if (status) {
      workflowsQuery += ` AND w.Status = ?`;
      queryParams.push(status);
    }

    workflowsQuery += `
      GROUP BY w.Id, w.Title, w.Status, w.CreatedAt, w.CompletedAt, w.CompletedBy
      ORDER BY w.CreatedAt DESC
    `;

    const workflows = await db.prepare(workflowsQuery).bind(...queryParams).all();

    return NextResponse.json({
      success: true,
      workflows: workflows.results || []
    });
  } catch (error) {
    console.error('Workflow list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
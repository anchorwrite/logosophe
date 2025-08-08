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
      return NextResponse.json({ error: 'You do not have permission to view workflow history' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

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

    // Get workflow history for the user in this tenant
    const historyQuery = `
      SELECT 
        w.Id,
        w.Title,
        w.Status,
        w.CreatedAt,
        w.CompletedAt,
        w.CompletedBy,
        COUNT(wm.Id) as messageCount,
        MAX(wm.CreatedAt) as lastActivity
      FROM Workflows w
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.TenantId = ?
        AND EXISTS (
          SELECT 1 FROM WorkflowParticipants wp 
          WHERE wp.WorkflowId = w.Id AND wp.ParticipantEmail = ?
        )
      GROUP BY w.Id, w.Title, w.Status, w.CreatedAt, w.CompletedAt, w.CompletedBy
      ORDER BY w.CreatedAt DESC
      LIMIT 100
    `;

    const workflows = await db.prepare(historyQuery).bind(tenantId, access.email).all();

    // Get recent messages for each workflow
    const recentMessagesQuery = `
      SELECT 
        wm.WorkflowId,
        wm.SenderEmail,
        wm.Content,
        wm.MessageType,
        wm.CreatedAt,
        wm.MediaFileId
      FROM WorkflowMessages wm
      WHERE wm.WorkflowId IN (
        SELECT w.Id FROM Workflows w
        WHERE w.TenantId = ?
          AND EXISTS (
            SELECT 1 FROM WorkflowParticipants wp 
            WHERE wp.WorkflowId = w.Id AND wp.ParticipantEmail = ?
          )
      )
      ORDER BY wm.CreatedAt ASC
      LIMIT 50
    `;

    const recentMessages = await db.prepare(recentMessagesQuery).bind(tenantId, access.email).all();

    return NextResponse.json({
      success: true,
      workflows: workflows.results || [],
      recentMessages: recentMessages.results || []
    });

  } catch (error) {
    console.error('Workflow history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
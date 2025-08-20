import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getWorkflowHistoryLogger } from '@/lib/workflow-history';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to permanently delete workflows' }, { status: 403 });
    }

    const body = await request.json() as { workflowIds: string[] };
    const { workflowIds } = body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return NextResponse.json({ error: 'Workflow IDs are required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to permanently delete workflows' }, { status: 403 });
    }

    const results = {
      successful: [] as string[],
      failed: [] as { workflowId: string; error: string }[]
    };

    // Process each workflow
    for (const workflowId of workflowIds) {
      try {
        // Get workflow data for logging and validation
        const workflowData = await db.prepare('SELECT * FROM Workflows WHERE Id = ?')
          .bind(workflowId)
          .first();

        if (!workflowData) {
          results.failed.push({ workflowId, error: 'Workflow not found' });
          continue;
        }

        // Ensure workflow is in deleted state before hard delete
        if ((workflowData.Status as string) !== 'deleted') {
          results.failed.push({ workflowId, error: 'Only deleted workflows can be permanently deleted' });
          continue;
        }

        // If tenant admin, verify access to this workflow's tenant
        if (!isGlobalAdmin) {
          const userTenantAccess = await db.prepare(`
            SELECT 1 FROM TenantUsers tu
            WHERE tu.Email = ? AND tu.TenantId = ?
          `).bind(access.email, workflowData.TenantId as string).first();

          if (!userTenantAccess) {
            results.failed.push({ workflowId, error: 'You do not have access to this workflow' });
            continue;
          }
        }

        // Log permanent deletion to WorkflowHistory before deleting
        const workflowHistoryLogger = await getWorkflowHistoryLogger();
        await workflowHistoryLogger.logWorkflowPermanentlyDeleted(workflowData, access.email);

        // Delete in order to respect foreign key constraints
        await db.prepare('DELETE FROM WorkflowMessages WHERE WorkflowId = ?').bind(workflowId).run();
        await db.prepare('DELETE FROM WorkflowParticipants WHERE WorkflowId = ?').bind(workflowId).run();
        await db.prepare('DELETE FROM WorkflowInvitations WHERE WorkflowId = ?').bind(workflowId).run();
        await db.prepare('DELETE FROM Workflows WHERE Id = ?').bind(workflowId).run();

        results.successful.push(workflowId);

        // Log to system logs
        const normalizedLogging = new NormalizedLogging(db);
        const { ipAddress, userAgent } = extractRequestContext(request);
        await normalizedLogging.logWorkflowOperations({
          userEmail: access.email,
          tenantId: workflowData.TenantId as string,
          activityType: 'workflow_permanently_deleted',
          accessType: 'delete',
          targetId: workflowId,
          targetName: workflowData.Title as string,
          ipAddress,
          userAgent,
          metadata: {
            action: 'bulk_hard_delete',
            originalStatus: workflowData.Status as string,
            totalCount: workflowIds.length
          }
        });

      } catch (error) {
        console.error(`Error permanently deleting workflow ${workflowId}:`, error);
        results.failed.push({ 
          workflowId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Successfully permanently deleted ${results.successful.length} of ${workflowIds.length} workflows`
    });

  } catch (error) {
    console.error('Bulk permanent delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

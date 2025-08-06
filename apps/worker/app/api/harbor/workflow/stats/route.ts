import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
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

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (isAdmin) {
      // System admins have full access to all tenants
      // Continue with stats retrieval
    } else {
      // Check if user is a tenant admin (Credentials table with tenant role)
      const tenantAdminCheck = await db.prepare(`
        SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).first();

      if (tenantAdminCheck) {
        // Tenant admins have full access within their assigned tenants
        // We need to verify they have access to this specific tenant
        const tenantAccessCheck = await db.prepare(`
          SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first();

        if (!tenantAccessCheck) {
          return NextResponse.json(
            { success: false, error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }
      } else {
        // Regular users need specific role assignments in the tenant
        // Follow the proper role checking logic from .cursorules
        
        // 1. Check TenantUsers table for base role
        const tenantUserCheck = await db.prepare(`
          SELECT RoleId FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first<{ RoleId: string }>();

        // 2. Check UserRoles table for additional roles
        const userRolesCheck = await db.prepare(`
          SELECT RoleId FROM UserRoles WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).all<{ RoleId: string }>();

        // 3. Collect all user roles
        const userRoles: string[] = [];
        
        if (tenantUserCheck) {
          userRoles.push(tenantUserCheck.RoleId);
        }
        
        if (userRolesCheck.results) {
          userRoles.push(...userRolesCheck.results.map(r => r.RoleId));
        }

        if (userRoles.length === 0) {
          return NextResponse.json(
            { success: false, error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }

        // 4. Check if the user has any role that allows viewing workflow statistics
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer', 'subscriber'];
        const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
        
        if (!hasAllowedRole) {
          return NextResponse.json(
            { success: false, error: 'Your role does not allow viewing workflow statistics' },
            { status: 403 }
          );
        }
      }
    }

    // Get workflow statistics directly from database
    const statsQuery = `
      SELECT 
        COUNT(*) as totalWorkflows,
        SUM(CASE WHEN Status = 'active' THEN 1 ELSE 0 END) as activeWorkflows,
        SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as completedWorkflows,
        SUM(CASE WHEN Status = 'cancelled' THEN 1 ELSE 0 END) as cancelledWorkflows,
        AVG(CASE WHEN Status = 'completed' THEN 
          (julianday(CompletedAt) - julianday(CreatedAt)) 
        ELSE NULL END) as avgCompletionDays
      FROM Workflows 
      WHERE TenantId = ?
    `;

    const stats = await db.prepare(statsQuery).bind(tenantId).first();

    // Get recent activity (last 7 days)
    const recentActivityQuery = `
      SELECT 
        COUNT(*) as recentWorkflows,
        COUNT(DISTINCT w.Id) as workflowsWithMessages
      FROM Workflows w
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.TenantId = ? 
        AND w.CreatedAt >= datetime('now', '-7 days')
    `;

    const recentActivity = await db.prepare(recentActivityQuery).bind(tenantId).first();

    // Get top participants
    const topParticipantsQuery = `
      SELECT 
        wp.ParticipantEmail,
        COUNT(DISTINCT w.Id) as workflowCount,
        COUNT(wm.Id) as messageCount
      FROM WorkflowParticipants wp
      JOIN Workflows w ON wp.WorkflowId = w.Id
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId AND wm.SenderEmail = wp.ParticipantEmail
      WHERE w.TenantId = ?
      GROUP BY wp.ParticipantEmail
      ORDER BY messageCount DESC, workflowCount DESC
      LIMIT 5
    `;

    const topParticipants = await db.prepare(topParticipantsQuery).bind(tenantId).all();

    return NextResponse.json({
      success: true,
      stats: {
        totalWorkflows: stats?.totalWorkflows || 0,
        activeWorkflows: stats?.activeWorkflows || 0,
        completedWorkflows: stats?.completedWorkflows || 0,
        cancelledWorkflows: stats?.cancelledWorkflows || 0,
        avgCompletionDays: stats?.avgCompletionDays || 0,
        recentWorkflows: recentActivity?.recentWorkflows || 0,
        workflowsWithMessages: recentActivity?.workflowsWithMessages || 0,
        topParticipants: topParticipants?.results || []
      }
    });
  } catch (error) {
    console.error('Error in workflow stats API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
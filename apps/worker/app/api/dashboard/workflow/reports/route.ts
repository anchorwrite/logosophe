import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to generate reports' }, { status: 403 });
    }

    const body = await request.json() as {
      reportType: string;
      dateFrom: string;
      dateTo: string;
      includeDetails: boolean;
      format: string;
      tenantId?: string;
      status?: string;
      userEmail: string;
      isGlobalAdmin: boolean;
      accessibleTenants: string[];
    };

    const { 
      reportType, 
      dateFrom, 
      dateTo, 
      includeDetails, 
      format, 
      tenantId, 
      status,
      userEmail,
      isGlobalAdmin,
      accessibleTenants 
    } = body;

    if (!reportType || !dateFrom || !dateTo || !format) {
      return NextResponse.json({ error: 'Missing required report parameters' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdminVerified = await isSystemAdmin(userEmail, db);
    const isTenantAdmin = !isGlobalAdminVerified && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(userEmail).first();

    if (!isGlobalAdminVerified && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to generate reports' }, { status: 403 });
    }

    // Build tenant filter
    let tenantFilter = '';
    let tenantParams: string[] = [];
    
    if (tenantId) {
      // If specific tenant is requested, verify access
      if (!isGlobalAdminVerified) {
        const hasAccess = accessibleTenants.includes(tenantId);
        if (!hasAccess) {
          return NextResponse.json({ error: 'You do not have access to the specified tenant' }, { status: 403 });
        }
      }
      tenantFilter = 'AND w.TenantId = ?';
      tenantParams = [tenantId];
    } else if (!isGlobalAdminVerified) {
      // Tenant admin without specific tenant - use accessible tenants
      if (accessibleTenants.length > 0) {
        tenantFilter = `AND w.TenantId IN (${accessibleTenants.map(() => '?').join(',')})`;
        tenantParams = accessibleTenants;
      }
    }

    // Build status filter
    let statusFilter = '';
    if (status) {
      statusFilter = 'AND w.Status = ?';
      tenantParams.push(status);
    }

    // Build query based on report type
    let query = '';
    let queryParams = [dateFrom, dateTo, ...tenantParams];

    switch (reportType) {
      case 'summary':
        query = `
          SELECT 
            COUNT(*) as totalWorkflows,
            SUM(CASE WHEN w.Status = 'active' THEN 1 ELSE 0 END) as activeWorkflows,
            SUM(CASE WHEN w.Status = 'completed' THEN 1 ELSE 0 END) as completedWorkflows,
            SUM(CASE WHEN w.Status = 'terminated' THEN 1 ELSE 0 END) as terminatedWorkflows,
            AVG(CASE WHEN w.Status = 'completed' THEN 
              (julianday(w.UpdatedAt) - julianday(w.CreatedAt)) * 24 * 60 
            ELSE NULL END) as avgCompletionTime
          FROM Workflows w
          WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
        `;
        break;

      case 'detailed':
        query = `
          SELECT 
            w.Id,
            w.Title,
            w.Description,
            w.Status,
            w.InitiatorEmail,
            w.InitiatorRole,
            w.CreatedAt,
            w.UpdatedAt,
            t.Name as TenantName,
            COUNT(DISTINCT wp.Email) as ParticipantCount,
            COUNT(DISTINCT wm.Id) as MessageCount
          FROM Workflows w
          LEFT JOIN Tenants t ON w.TenantId = t.Id
          LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
          LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
          WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
          GROUP BY w.Id, w.Title, w.Description, w.Status, w.InitiatorEmail, w.InitiatorRole, w.CreatedAt, w.UpdatedAt, t.Name
          ORDER BY w.CreatedAt DESC
        `;
        break;

      case 'performance':
        query = `
          SELECT 
            w.Status,
            COUNT(*) as count,
            AVG(CASE WHEN w.Status = 'completed' THEN 
              (julianday(w.UpdatedAt) - julianday(w.CreatedAt)) * 24 * 60 
            ELSE NULL END) as avgCompletionTime,
            AVG(participant_count) as avgParticipants,
            AVG(message_count) as avgMessages
          FROM (
            SELECT 
              w.Id,
              w.Status,
              w.CreatedAt,
              w.UpdatedAt,
              COUNT(DISTINCT wp.Email) as participant_count,
              COUNT(DISTINCT wm.Id) as message_count
            FROM Workflows w
            LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
            LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
            WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
            GROUP BY w.Id, w.Status, w.CreatedAt, w.UpdatedAt
          ) w
          GROUP BY w.Status
        `;
        break;

      case 'activity':
        query = `
          SELECT 
            DATE(w.CreatedAt) as date,
            COUNT(*) as created,
            SUM(CASE WHEN w.Status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN w.Status = 'terminated' THEN 1 ELSE 0 END) as terminated
          FROM Workflows w
          WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
          GROUP BY DATE(w.CreatedAt)
          ORDER BY date
        `;
        break;

      case 'participants':
        query = `
          SELECT 
            wp.Email,
            wp.Role,
            COUNT(DISTINCT w.Id) as workflowCount,
            AVG(participant_count) as avgParticipantsPerWorkflow,
            SUM(message_count) as totalMessages
          FROM WorkflowParticipants wp
          JOIN Workflows w ON wp.WorkflowId = w.Id
          LEFT JOIN (
            SELECT 
              w.Id,
              COUNT(DISTINCT wp2.Email) as participant_count,
              COUNT(DISTINCT wm.Id) as message_count
            FROM Workflows w
            LEFT JOIN WorkflowParticipants wp2 ON w.Id = wp2.WorkflowId
            LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
            WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
            GROUP BY w.Id
          ) stats ON w.Id = stats.Id
          WHERE w.CreatedAt >= ? AND w.CreatedAt <= ? ${tenantFilter} ${statusFilter}
          GROUP BY wp.Email, wp.Role
          ORDER BY workflowCount DESC
        `;
        // Add duplicate parameters for the subquery
        queryParams = [...queryParams, ...queryParams];
        break;

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    const result = await db.prepare(query).bind(...queryParams).all();
    const reportData = result.results || [];

    // Generate report based on format
    let reportContent: string;
    let contentType: string;
    let fileName: string;

    switch (format) {
      case 'json':
        reportContent = JSON.stringify({
          reportType,
          dateFrom,
          dateTo,
          generatedAt: new Date().toISOString(),
          data: reportData
        }, null, 2);
        contentType = 'application/json';
        fileName = `workflow-${reportType}-${new Date().toISOString().split('T')[0]}.json`;
        break;

      case 'csv':
        if (reportData.length === 0) {
          reportContent = 'No data available';
        } else {
          const headers = Object.keys(reportData[0]);
          const csvRows = [
            headers.join(','),
            ...reportData.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row];
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
              }).join(',')
            )
          ];
          reportContent = csvRows.join('\n');
        }
        contentType = 'text/csv';
        fileName = `workflow-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'pdf':
        // PDF generation not implemented in worker yet
        return NextResponse.json({ 
          error: 'PDF generation is not available yet. Please use JSON or CSV format.' 
        }, { status: 501 });

      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    // Create a temporary file or return the content directly
    // For now, we'll return the content as base64 for download
    const base64Content = btoa(unescape(encodeURIComponent(reportContent)));
    const dataUrl = `data:${contentType};base64,${base64Content}`;

    return NextResponse.json({
      success: true,
      downloadUrl: dataUrl,
      fileName,
      contentType
    });

  } catch (error) {
    console.error('Dashboard workflow reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
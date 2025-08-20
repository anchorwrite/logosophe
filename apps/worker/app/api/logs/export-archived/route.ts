import { NextResponse } from 'next/server';
import { SystemLogs } from '@/lib/system-logs';
import { getDB } from '@/lib/request-context';
import { isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';

export async function POST() {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only system admins can export archived logs
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const systemLogs = new SystemLogs(db);
        
        // Get all archived logs (no pagination for export)
        const { logs } = await systemLogs.getArchivedLogs({
            limit: undefined, // No limit for export
            offset: 0
        });

        if (logs.length === 0) {
            return new Response('No archived logs to export', { status: 404 });
        }

        // Generate CSV content
        const csvHeaders = [
            'Id',
            'LogType',
            'Timestamp',
            'UserId',
            'UserEmail',
            'Provider',
            'TenantId',
            'ActivityType',
            'AccessType',
            'TargetId',
            'TargetName',
            'IpAddress',
            'UserAgent',
            'Metadata',
            'IsDeleted'
        ];

        const csvRows = logs.map(log => [
            log.id || '',
            log.logType || '',
            log.timestamp || '',
            log.userId || '',
            log.userEmail || '',
            log.provider || '',
            log.tenantId || '',
            log.activityType || '',
            log.accessType || '',
            log.targetId || '',
            log.targetName || '',
            log.ipAddress || '',
            log.userAgent || '',
            log.metadata ? JSON.stringify(log.metadata) : '',
            log.isDeleted ? '1' : '0'
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        // Return uncompressed CSV with appropriate headers
        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="archived-logs-${new Date().toISOString().split('T')[0]}.csv"`,
                'Content-Length': csvContent.length.toString()
            }
        });
    } catch (error) {
        console.error('Error exporting archived logs:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

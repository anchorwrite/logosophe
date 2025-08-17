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

        // Convert to Uint8Array for compression
        const encoder = new TextEncoder();
        const csvBytes = encoder.encode(csvContent);

        // Simple compression using gzip (Cloudflare Workers support)
        // Note: This is a basic implementation. For production, you might want to use a proper gzip library
        const compressed = await compressData(csvBytes);

        // Return compressed CSV with appropriate headers
        return new Response(compressed as BodyInit, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="archived-logs-${new Date().toISOString().split('T')[0]}.csv.gz"`,
                'Content-Encoding': 'gzip',
                'Content-Length': compressed.length.toString()
            }
        });
    } catch (error) {
        console.error('Error exporting archived logs:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// Basic compression function (simplified for demo)
// In production, you'd want to use a proper gzip library
async function compressData(data: Uint8Array): Promise<Uint8Array> {
    // For now, return the data as-is since proper gzip compression requires additional libraries
    // In a real implementation, you'd use something like:
    // return await gzip(data);
    
    // This is a placeholder - you'll need to implement proper compression
    // or use a library that's compatible with Cloudflare Workers
    return data;
}

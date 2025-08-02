import { NextRequest, NextResponse } from 'next/server';
import { SystemLogs } from '@/lib/system-logs';
import { getDB } from '@/lib/request-context';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { auth } from '@/auth';
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Get the database
    const db = await getDB();
    const searchParams = request.nextUrl.searchParams;
    
    // Extract all filter parameters
    const tenantId = searchParams.get('tenantId');
    const logType = searchParams.get('logType') as any;
    const activityType = searchParams.get('activityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const ipAddress = searchParams.get('ipAddress');
    const userEmail = searchParams.get('userEmail');
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortField = searchParams.get('sortField') || 'timestamp';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    // If not admin, verify tenant access
    if (!isAdmin && tenantId) {
        const isTenantAdmin = await isTenantAdminFor(session.user.email, tenantId);
        if (!isTenantAdmin) {
            return new Response('Forbidden', { status: 403 });
        }
    }

    const systemLogs = new SystemLogs(db);
    const { logs, totalCount } = await systemLogs.queryLogs({
        logType,
        activityType: activityType || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        tenantId: tenantId || undefined,
        search: search || undefined,
        ipAddress: ipAddress || undefined,
        userEmail: userEmail || undefined,
        limit,
        offset,
        sortField,
        sortOrder
    });

    return Response.json({ logs, totalCount });
} 
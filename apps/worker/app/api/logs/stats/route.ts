import { NextResponse } from 'next/server';
import { SystemLogs } from '@/lib/system-logs';
import { getDB } from '@/lib/request-context';
import { isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only system admins can view log statistics
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const systemLogs = new SystemLogs(db);
        const stats = await systemLogs.getLogStats();
        
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching log stats:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

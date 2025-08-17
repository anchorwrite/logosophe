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

    // Only system admins can hard delete archived logs
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const systemLogs = new SystemLogs(db);
        
        // Get the hard delete delay setting
        const delaySetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_hard_delete_delay'
        `).first();
        
        const hardDeleteDelay = delaySetting ? parseInt((delaySetting as any).Value) : 7; // Default to 7 days
        
        // Hard delete archived logs that are older than the delay period
        const result = await systemLogs.hardDeleteArchivedLogs(hardDeleteDelay);
        
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error hard deleting archived logs:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

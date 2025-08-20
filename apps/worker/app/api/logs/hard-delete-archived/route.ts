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
        
        // Get both retention and hard delete delay settings
        const retentionSetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_retention_days'
        `).first();
        
        const delaySetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_hard_delete_delay'
        `).first();
        
        const retentionDays = retentionSetting ? parseInt((retentionSetting as any).Value) : 90; // Default to 90 days
        const hardDeleteDelay = delaySetting ? parseInt((delaySetting as any).Value) : 7; // Default to 7 days
        
        // Hard delete archived logs that are older than retention + hard delete delay
        const result = await systemLogs.hardDeleteArchivedLogs(retentionDays, hardDeleteDelay);
        
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error hard deleting archived logs:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

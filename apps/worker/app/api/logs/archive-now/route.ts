import { NextResponse } from 'next/server';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { SystemLogs } from '@/lib/system-logs';
import { getDB } from '@/lib/request-context';
import { isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';

export async function POST() {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only system admins can manually trigger archive jobs
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const normalizedLogging = new NormalizedLogging(db);
        const systemLogs = new SystemLogs(db);
        
        // Get the retention settings
        const retentionSetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_retention_days'
        `).first();
        
        const archiveEnabledSetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_archive_enabled'
        `).first();
        
        const retentionDays = retentionSetting ? parseInt((retentionSetting as any).Value) : 90;
        const archiveEnabled = archiveEnabledSetting ? (archiveEnabledSetting as any).Value === 'true' : true;
        
        if (!archiveEnabled) {
            return NextResponse.json({ 
                success: false, 
                message: 'Log archiving is disabled',
                processed: 0
            });
        }
        
        // Archive expired logs
        const archiveResult = await systemLogs.archiveExpiredLogs(retentionDays);
        
        // Also check if we should hard delete old archived logs
        const hardDeleteDelaySetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_hard_delete_delay'
        `).first();
        
        const hardDeleteDelay = hardDeleteDelaySetting ? parseInt((hardDeleteDelaySetting as any).Value) : 7;
        const hardDeleteResult = await systemLogs.hardDeleteArchivedLogs(hardDeleteDelay);
        
        // Log this manual operation
        await normalizedLogging.logSystemOperations({
            userEmail: session.user.email,
            tenantId: 'system',
            activityType: 'manual_log_archive',
            accessType: 'admin',
            targetId: 'log-archive',
            targetName: 'Manual Log Archive',
            metadata: {
                retentionDays,
                archiveResult,
                hardDeleteResult,
                triggeredBy: 'manual'
            }
        });
        
        return NextResponse.json({
            success: true,
            message: 'Manual log archiving completed',
            timestamp: new Date().toISOString(),
            retentionDays,
            archiveResult,
            hardDeleteResult,
            processed: (archiveResult.archived || 0) + (hardDeleteResult.deleted || 0)
        });
        
    } catch (error) {
        console.error('Error in manual log archive:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

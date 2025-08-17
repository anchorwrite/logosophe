import { NextResponse } from 'next/server';
import { SystemLogs } from '@/lib/system-logs';
import { getDB } from '@/lib/request-context';

export async function GET() {
    // This endpoint is designed to be called by Cloudflare's cron triggers
    // It doesn't require authentication since it's called by the system
    
    try {
        const db = await getDB();
        const systemLogs = new SystemLogs(db);
        
        // Get the retention settings
        const retentionSetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_retention_days'
        `).first();
        
        const archiveEnabledSetting = await db.prepare(`
            SELECT Value FROM SystemSettings WHERE Key = 'log_archive_enabled'
        `).first();
        
        const retentionDays = retentionSetting ? parseInt((retentionSetting as any).Value) : 90; // Default to 90 days
        const archiveEnabled = archiveEnabledSetting ? (archiveEnabledSetting as any).Value === 'true' : true;
        
        if (!archiveEnabled) {
            return NextResponse.json({ 
                success: true, 
                message: 'Log archiving is disabled',
                archived: 0,
                errors: 0
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
        
        return NextResponse.json({
            success: true,
            message: 'Log archiving completed',
            timestamp: new Date().toISOString(),
            retentionDays,
            archiveResult,
            hardDeleteResult
        });
        
    } catch (error) {
        console.error('Error in log archive cron job:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// Also support POST for manual triggering
export async function POST() {
    return GET();
}

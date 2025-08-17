import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/request-context';
import { isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only system admins can view log settings
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const settings = await db.prepare(`
            SELECT Key, Value FROM SystemSettings 
            WHERE Key LIKE 'log_%'
            ORDER BY Key
        `).all();

        const settingsMap: Record<string, string> = {};
        settings.results.forEach((row: any) => {
            settingsMap[row.Key] = row.Value;
        });

        return NextResponse.json(settingsMap);
    } catch (error) {
        console.error('Error fetching log settings:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only system admins can update log settings
    const db = await getDB();
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const body = await request.json() as {
            log_retention_days?: string;
            log_archive_enabled?: string;
            log_hard_delete_delay?: string;
            log_archive_cron_schedule?: string;
        };
        const { log_retention_days, log_archive_enabled, log_hard_delete_delay, log_archive_cron_schedule } = body;

        // Validate inputs
        if (log_retention_days && (isNaN(Number(log_retention_days)) || Number(log_retention_days) < 1 || Number(log_retention_days) > 3650)) {
            return new Response('Invalid retention days (must be 1-3650)', { status: 400 });
        }

        if (log_hard_delete_delay && (isNaN(Number(log_hard_delete_delay)) || Number(log_hard_delete_delay) < 1 || Number(log_hard_delete_delay) > 365)) {
            return new Response('Invalid hard delete delay (must be 1-365)', { status: 400 });
        }

        // Update settings
        const updates = [];
        if (log_retention_days !== undefined) {
            updates.push(db.prepare(`
                INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedBy) 
                VALUES (?, ?, ?)
            `).bind('log_retention_days', log_retention_days.toString(), session.user.email));
        }

        if (log_archive_enabled !== undefined) {
            updates.push(db.prepare(`
                INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedBy) 
                VALUES (?, ?, ?)
            `).bind('log_archive_enabled', log_archive_enabled.toString(), session.user.email));
        }

        if (log_hard_delete_delay !== undefined) {
            updates.push(db.prepare(`
                INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedBy) 
                VALUES (?, ?, ?)
            `).bind('log_hard_delete_delay', log_hard_delete_delay.toString(), session.user.email));
        }

        if (log_archive_cron_schedule !== undefined) {
            updates.push(db.prepare(`
                INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedBy) 
                VALUES (?, ?, ?)
            `).bind('log_archive_cron_schedule', log_archive_cron_schedule, session.user.email));
        }

        // Execute all updates
        for (const update of updates) {
            await update.run();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating log settings:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

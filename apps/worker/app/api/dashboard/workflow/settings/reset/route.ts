import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to reset workflow settings' }, { status: 403 });
    }

    const body = await request.json() as {
      userEmail: string;
      isGlobalAdmin: boolean;
    };

    const { userEmail } = body;

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin
    const isGlobalAdmin = await isSystemAdmin(userEmail, db);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Only global administrators can reset workflow settings' }, { status: 403 });
    }

    // Default settings
    const defaultSettings = {
      maxWorkflowsPerTenant: 100,
      maxParticipantsPerWorkflow: 50,
      maxMessagesPerWorkflow: 1000,
      workflowTimeoutHours: 168,
      autoArchiveDays: 30,
      allowWorkflowPause: true,
      allowWorkflowTermination: true,
      requireApproval: false,
      enableNotifications: true,
      enableAuditLogging: true,
      defaultWorkflowStatus: 'active',
      retentionPolicy: '90days',
      backupFrequency: 'daily',
      ssePollingIntervalMs: 15000
    };

    // Reset settings in database
    const timestamp = new Date().toISOString();
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      await db.prepare(`
        INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedAt, UpdatedBy)
        VALUES (?, ?, ?, ?)
      `).bind(`workflow_${key}`, value.toString(), timestamp, userEmail).run();
    }

    // Log the settings reset
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logWorkflowOperations({
      userEmail: userEmail,
      tenantId: 'system',
      activityType: 'workflow_settings_reset',
      accessType: 'admin',
      targetId: 'workflow_settings',
      targetName: 'Workflow Settings',
      ipAddress,
      userAgent,
      metadata: { settings: Object.keys(defaultSettings) }
    });

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults successfully',
      config: {
        settings: defaultSettings,
        lastUpdated: timestamp,
        updatedBy: userEmail
      }
    });

  } catch (error) {
    console.error('Dashboard workflow settings reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
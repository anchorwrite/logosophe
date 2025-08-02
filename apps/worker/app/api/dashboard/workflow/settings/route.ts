import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SystemLogs } from '@/lib/system-logs';


export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow settings' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Only global administrators can view workflow settings' }, { status: 403 });
    }

    // Get current settings from database
    const settingsResult = await db.prepare(`
      SELECT 
        SettingKey,
        SettingValue,
        LastUpdated,
        UpdatedBy
      FROM SystemSettings 
      WHERE Category = 'workflow'
      ORDER BY SettingKey
    `).all() as { results: { SettingKey: string; SettingValue: string; LastUpdated: string; UpdatedBy: string }[] };

    // Convert database results to settings object
    const settings: Record<string, any> = {};
    let lastUpdated = '';
    let updatedBy = '';

    settingsResult.results.forEach(row => {
      const key = row.SettingKey;
      let value: any = row.SettingValue;
      
      // Parse value based on expected type
      if (key.includes('max') || key.includes('Timeout') || key.includes('Days')) {
        value = parseInt(value);
      } else if (key.includes('allow') || key.includes('enable') || key.includes('require')) {
        value = value === 'true';
      }
      
      settings[key] = value;
      
      // Track the most recent update
      if (!lastUpdated || row.LastUpdated > lastUpdated) {
        lastUpdated = row.LastUpdated;
        updatedBy = row.UpdatedBy;
      }
    });

    // Provide defaults for missing settings
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
      backupFrequency: 'daily'
    };

    // Merge with defaults
    const mergedSettings = { ...defaultSettings, ...settings };

    return NextResponse.json({
      success: true,
      config: {
        settings: mergedSettings,
        lastUpdated: lastUpdated || new Date().toISOString(),
        updatedBy: updatedBy || 'system'
      }
    });

  } catch (error) {
    console.error('Dashboard workflow settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to modify workflow settings' }, { status: 403 });
    }

    const body = await request.json() as {
      settings: Record<string, any>;
      userEmail: string;
      isGlobalAdmin: boolean;
    };

    const { settings, userEmail } = body;

    if (!settings) {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin
    const isGlobalAdmin = await isSystemAdmin(userEmail, db);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Only global administrators can modify workflow settings' }, { status: 403 });
    }

    // Validate settings
    const validationErrors: string[] = [];
    
    if (settings.maxWorkflowsPerTenant && (settings.maxWorkflowsPerTenant < 1 || settings.maxWorkflowsPerTenant > 10000)) {
      validationErrors.push('Max workflows per tenant must be between 1 and 10000');
    }
    
    if (settings.maxParticipantsPerWorkflow && (settings.maxParticipantsPerWorkflow < 1 || settings.maxParticipantsPerWorkflow > 1000)) {
      validationErrors.push('Max participants per workflow must be between 1 and 1000');
    }
    
    if (settings.maxMessagesPerWorkflow && (settings.maxMessagesPerWorkflow < 1 || settings.maxMessagesPerWorkflow > 100000)) {
      validationErrors.push('Max messages per workflow must be between 1 and 100000');
    }
    
    if (settings.workflowTimeoutHours && (settings.workflowTimeoutHours < 1 || settings.workflowTimeoutHours > 8760)) {
      validationErrors.push('Workflow timeout must be between 1 and 8760 hours');
    }
    
    if (settings.autoArchiveDays && (settings.autoArchiveDays < 0 || settings.autoArchiveDays > 3650)) {
      validationErrors.push('Auto-archive days must be between 0 and 3650');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors.join(', ') }, { status: 400 });
    }

    // Update settings in database
    const timestamp = new Date().toISOString();
    
    for (const [key, value] of Object.entries(settings)) {
      await db.prepare(`
        INSERT OR REPLACE INTO SystemSettings (Category, SettingKey, SettingValue, LastUpdated, UpdatedBy)
        VALUES (?, ?, ?, ?, ?)
      `).bind('workflow', key, value.toString(), timestamp, userEmail).run();
    }

    // Log the settings change
    const systemLogs = new SystemLogs(db);
    await systemLogs.logTenantOperation({
      userEmail: userEmail,
      activityType: 'WORKFLOW_SETTINGS_UPDATED',
      targetId: 'workflow_settings',
      targetName: 'Workflow Settings',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { settings: Object.keys(settings) }
    });

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Dashboard workflow settings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
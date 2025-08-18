import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor, hasPermission, type ResourceType } from './access';
import { SystemLogs } from './system-logs';

/**
 * Check if workflow system is enabled
 */
export async function isWorkflowEnabled(): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const setting = await db.prepare(`
    SELECT Value FROM SystemSettings WHERE Key = 'workflow_enabled'
  `).first() as { Value: string } | null;
  
  return setting?.Value === 'true';
}

/**
 * Get user's accessible tenants for workflow access
 */
export async function getUserWorkflowTenants(userEmail: string): Promise<string[]> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // System admins have access to all tenants
  if (await isSystemAdmin(userEmail, db)) {
    const tenants = await db.prepare(`
      SELECT Id FROM Tenants
    `).all() as { results: { Id: string }[] };
    return tenants.results?.map(t => t.Id) || [];
  }

  // Get tenants where user is a member
  const tenants = await db.prepare(`
    SELECT DISTINCT t.Id
    FROM Tenants t
    JOIN TenantUsers tu ON t.Id = tu.TenantId
    WHERE tu.Email = ?
  `).bind(userEmail).all() as { results: { Id: string }[] };

  return tenants.results?.map(t => t.Id) || [];
}

/**
 * Check if user can create workflows in a tenant
 */
export async function canCreateWorkflow(
  userEmail: string, 
  tenantId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if workflow system is enabled
  const workflowEnabled = await isWorkflowEnabled();
  if (!workflowEnabled) {
    return { allowed: false, error: 'Workflow system is disabled' };
  }
  
  // System admins can create workflows in any tenant
  if (await isSystemAdmin(userEmail, db)) {
    return { allowed: true };
  }
  
  // Check if user is tenant admin
  if (await isTenantAdminFor(userEmail, tenantId)) {
    return { allowed: true };
  }
  
  // Check if user has workflow creation permission
  const hasCreatePermission = await hasPermission(userEmail, tenantId, 'workflow' as ResourceType, 'write');
  if (!hasCreatePermission) {
    return { allowed: false, error: 'You do not have permission to create workflows' };
  }
  
  return { allowed: true };
}

/**
 * Check if user can participate in a workflow
 */
export async function canParticipateInWorkflow(
  userEmail: string, 
  tenantId: string,
  workflowId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if workflow system is enabled
  const workflowEnabled = await isWorkflowEnabled();
  if (!workflowEnabled) {
    return { allowed: false, error: 'Workflow system is disabled' };
  }
  
  // System admins can participate in any workflow
  if (await isSystemAdmin(userEmail, db)) {
    return { allowed: true };
  }
  
  // Check if user is tenant admin
  if (await isTenantAdminFor(userEmail, tenantId)) {
    return { allowed: true };
  }
  
  // Check if user has workflow read permission
  const hasReadPermission = await hasPermission(userEmail, tenantId, 'workflow' as ResourceType, 'read');
  if (!hasReadPermission) {
    return { allowed: false, error: 'You do not have permission to participate in workflows' };
  }
  
  // Check if workflow belongs to user's tenant
  const workflow = await db.prepare(`
    SELECT 1 FROM Workflows 
    WHERE Id = ? AND TenantId = ?
  `).bind(workflowId, tenantId).first();
  
  if (!workflow) {
    return { allowed: false, error: 'Workflow not found or access denied' };
  }
  
  return { allowed: true };
}

/**
 * Check if user can send messages in a workflow
 */
export async function canSendWorkflowMessage(
  userEmail: string, 
  tenantId: string,
  workflowId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if workflow system is enabled
  const workflowEnabled = await isWorkflowEnabled();
  if (!workflowEnabled) {
    return { allowed: false, error: 'Workflow system is disabled' };
  }
  
  // System admins can send messages in any workflow
  if (await isSystemAdmin(userEmail, db)) {
    return { allowed: true };
  }
  
  // Check if user is tenant admin
  if (await isTenantAdminFor(userEmail, tenantId)) {
    return { allowed: true };
  }
  
  // Check if user has workflow write permission
  const hasWritePermission = await hasPermission(userEmail, tenantId, 'workflow' as ResourceType, 'write');
  if (!hasWritePermission) {
    return { allowed: false, error: 'You do not have permission to send workflow messages' };
  }
  
  // Check if workflow belongs to user's tenant
  const workflow = await db.prepare(`
    SELECT 1 FROM Workflows 
    WHERE Id = ? AND TenantId = ?
  `).bind(workflowId, tenantId).first();
  
  if (!workflow) {
    return { allowed: false, error: 'Workflow not found or access denied' };
  }
  
  return { allowed: true };
}

/**
 * Check if user can complete a workflow
 */
export async function canCompleteWorkflow(
  userEmail: string, 
  tenantId: string,
  workflowId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  console.log('canCompleteWorkflow: Starting check for:', { userEmail, tenantId, workflowId });
  
  // Check if workflow system is enabled
  const workflowEnabled = await isWorkflowEnabled();
  console.log('canCompleteWorkflow: Workflow system enabled:', workflowEnabled);
  if (!workflowEnabled) {
    return { allowed: false, error: 'Workflow system is disabled' };
  }
  
  // System admins can complete any workflow
  const isSystemAdminResult = await isSystemAdmin(userEmail, db);
  console.log('canCompleteWorkflow: Is system admin:', isSystemAdminResult);
  if (isSystemAdminResult) {
    return { allowed: true };
  }
  
  // Check if user is tenant admin
  const isTenantAdminResult = await isTenantAdminFor(userEmail, tenantId);
  console.log('canCompleteWorkflow: Is tenant admin:', isTenantAdminResult);
  if (isTenantAdminResult) {
    return { allowed: true };
  }
  
  // Check if user has workflow complete permission
  const hasCompletePermission = await hasPermission(userEmail, tenantId, 'workflow' as ResourceType, 'complete');
  console.log('canCompleteWorkflow: Has complete permission:', hasCompletePermission);
  if (!hasCompletePermission) {
    return { allowed: false, error: 'You do not have permission to complete workflows' };
  }
  
  // Check if workflow belongs to user's tenant
  const workflow = await db.prepare(`
    SELECT 1 FROM Workflows 
    WHERE Id = ? AND TenantId = ?
  `).bind(workflowId, tenantId).first();
  
  console.log('canCompleteWorkflow: Workflow exists in tenant:', !!workflow);
  if (!workflow) {
    return { allowed: false, error: 'Workflow not found or access denied' };
  }
  
  console.log('canCompleteWorkflow: All checks passed - allowed');
  return { allowed: true };
}

/**
 * Complete a workflow (server-side version with permission checking)
 */
export async function completeWorkflow(
  workflowId: string,
  userEmail: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions first
    const permissionCheck = await canCompleteWorkflow(userEmail, tenantId, workflowId);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.error || 'Permission denied' };
    }

    const response = await fetch(`/api/workflow/${workflowId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        completedBy: userEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to complete workflow: ${error}` };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Error completing workflow:', error);
    return { success: false, error: 'Failed to complete workflow' };
  }
}

/**
 * Log workflow activity
 */
export async function logWorkflowActivity(
  activityType: string,
  userEmail: string,
  tenantId: string,
  workflowId: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);
  
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail,
    activityType,
    targetId: workflowId,
    targetName: 'workflow',
    metadata: {
      tenantId,
      ...metadata
    }
  });
}

/**
 * Get workflow system settings
 */
export async function getWorkflowSystemSettings(): Promise<Record<string, string>> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const settings = await db.prepare(`
    SELECT Key, Value FROM SystemSettings 
    WHERE Key LIKE 'workflow_%'
  `).all() as { results: { Key: string; Value: string }[] };
  
  const settingsMap: Record<string, string> = {};
  settings.results?.forEach(setting => {
    settingsMap[setting.Key] = setting.Value;
  });
  
  return settingsMap;
}

/**
 * Update workflow system setting
 */
export async function updateWorkflowSystemSetting(
  key: string, 
  value: string, 
  updatedBy: string
): Promise<void> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  await db.prepare(`
    INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedBy, UpdatedAt)
    VALUES (?, ?, ?, ?)
  `).bind(key, value, updatedBy, new Date().toISOString()).run();
} 
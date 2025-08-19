/**
 * Normalized Logging System for Logosophe
 * 
 * This implements the normalized column structure where each column contains
 * exactly one piece of data, enabling clean analytics and proper data relationships.
 */

import { SystemLogs } from './system-logs';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// =============================================================================
// NORMALIZED LOG TYPE DEFINITIONS
// =============================================================================

export type NormalizedLogType = 
  | 'access_control'      // Role assignments, permission changes, access management
  | 'user_management'     // User creation, profile updates, tenant assignments
  | 'media_operations'    // File uploads, downloads, deletions, publishing
  | 'workflow_operations' // Workflow creation, messages, participant management
  | 'messaging_operations' // Message sending, archiving, system messaging
  | 'system_operations'   // System settings, configuration changes
  | 'authentication'      // Sign in/out, session management
  | 'test_operations';    // Test session creation, validation

export type NormalizedAccessType = 
  | 'view' | 'download' | 'write' | 'read' | 'delete' | 'admin' | 'auth';

// =============================================================================
// NORMALIZED LOGGING INTERFACES
// =============================================================================

export interface NormalizedLogData {
  // Core identification
  logType: NormalizedLogType;
  timestamp: string;
  
  // User context
  userId?: string;
  userEmail: string;
  provider?: string;
  tenantId?: string;
  
  // Action context
  activityType: string;
  accessType: NormalizedAccessType;
  
  // Target context
  targetId: string;
  targetName: string;
  
  // Request context
  ipAddress?: string;
  userAgent?: string;
  
  // Additional context
  metadata?: Record<string, any>;
}

// =============================================================================
// TARGET ID MAPPING UTILITIES
// =============================================================================

export interface TargetIdMapping {
  users: 'Credentials.Email';
  roles: 'Roles.Id';
  tenants: 'Tenants.Id';
  mediaFiles: 'MediaFiles.Id';
  publishedContent: 'PublishedContent.Id';
  workflows: 'Workflows.Id';
  workflowMessages: 'WorkflowMessages.Id';
  messages: 'Messages.Id';
  testSessions: 'TestSessions.Id';
  systemComponents: 'custom_identifier';
}

// =============================================================================
// NORMALIZED LOGGING CLASS
// =============================================================================

export class NormalizedLogging {
  private systemLogs: SystemLogs;

  constructor(db: D1Database) {
    this.systemLogs = new SystemLogs(db);
  }

  /**
   * Create a normalized log entry with proper column structure
   */
  async createNormalizedLog(data: NormalizedLogData): Promise<number> {
    return this.systemLogs.createLog({
      logType: data.logType,
      timestamp: data.timestamp,
      userId: data.userId,
      userEmail: data.userEmail,
      provider: data.provider,
      tenantId: data.tenantId,
      activityType: data.activityType,
      accessType: data.accessType,
      targetId: data.targetId,
      targetName: data.targetName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
      isDeleted: false
    });
  }

  /**
   * Safe normalized logging with error handling
   */
  async safeNormalizedLog(
    logOperation: () => Promise<number>,
    operationName: string,
    fallbackData?: Partial<NormalizedLogData>
  ): Promise<number | null> {
    try {
      return await logOperation();
    } catch (error) {
      console.error(`[NORMALIZED LOGGING ERROR] Failed to log ${operationName}:`, error);

      // Try to log the logging failure if we have fallback data
      if (fallbackData) {
        try {
          await this.createNormalizedLog({
            logType: 'system_operations',
            timestamp: new Date().toISOString(),
            userEmail: fallbackData.userEmail || 'system',
            activityType: 'logging_failure',
            accessType: 'admin',
            targetId: fallbackData.targetId || 'unknown',
            targetName: fallbackData.targetName || 'unknown',
            metadata: {
              originalOperation: operationName,
              error: error instanceof Error ? error.message : String(error),
              fallbackData
            }
          });
        } catch (fallbackError) {
          console.error('[CRITICAL] Even fallback normalized logging failed:', fallbackError);
        }
      }

      return null;
    }
  }

  // =============================================================================
  // SPECIALIZED LOGGING METHODS BY CATEGORY
  // =============================================================================

  /**
   * Log access control operations (role assignments, permissions)
   */
  async logAccessControl(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'access_control',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `access_control_${data.activityType}`,
      data
    );
  }

  /**
   * Log user management operations
   */
  async logUserManagement(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'user_management',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `user_management_${data.activityType}`,
      data
    );
  }

  /**
   * Log media operations
   */
  async logMediaOperations(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'media_operations',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `media_operations_${data.activityType}`,
      data
    );
  }

  /**
   * Log workflow operations
   */
  async logWorkflowOperations(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'workflow_operations',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `workflow_operations_${data.activityType}`,
      data
    );
  }

  /**
   * Log messaging operations
   */
  async logMessagingOperations(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'messaging_operations',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `messaging_operations_${data.activityType}`,
      data
    );
  }

  /**
   * Log system operations
   */
  async logSystemOperations(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'system_operations',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `system_operations_${data.activityType}`,
      data
    );
  }

  /**
   * Log authentication operations
   */
  async logAuthentication(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'authentication',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `authentication_${data.activityType}`,
      data
    );
  }

  /**
   * Log test operations
   */
  async logTestOperations(data: {
    userEmail: string;
    userId?: string;
    provider?: string;
    tenantId?: string;
    activityType: string;
    accessType: NormalizedAccessType;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<number | null> {
    return this.safeNormalizedLog(
      () => this.createNormalizedLog({
        logType: 'test_operations',
        timestamp: new Date().toISOString(),
        ...data
      }),
      `test_operations_${data.activityType}`,
      data
    );
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract request context (IP, User Agent) from a request
 */
export function extractRequestContext(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               request.headers.get('cf-connecting-ip') ||
               undefined,
    userAgent: request.headers.get('user-agent') || undefined
  };
}

/**
 * Create normalized metadata with language support
 */
export function createNormalizedMetadata(
  baseData: Record<string, any>,
  language?: string
): Record<string, any> {
  return {
    ...baseData,
    timestamp: new Date().toISOString(),
    ...(language && { language })
  };
}

/**
 * Standardized logging utilities for consistent error handling and logging patterns
 */

import { NormalizedLogging } from './normalized-logging';

/**
 * Wrapper function that safely executes logging operations
 * If logging fails, it logs the error to console but doesn't break the main operation
 */
export async function safeLog(
    logOperation: () => Promise<number | null>,
    operationName: string,
    fallbackMetadata?: Record<string, any>
): Promise<number | null> {
    try {
        return await logOperation();
    } catch (error) {
        console.error(`[LOGGING ERROR] Failed to log ${operationName}:`, error);
        
        // If we have fallback metadata, try to log the logging failure
        if (fallbackMetadata) {
            try {
                const { getCloudflareContext } = await import('@opennextjs/cloudflare');
                const context = await getCloudflareContext({ async: true });
                const db = context.env.DB;
                const normalizedLogging = new NormalizedLogging(db);
                
                await normalizedLogging.logSystemOperations({
                    userEmail: fallbackMetadata.userEmail || 'system',
                    tenantId: 'system',
                    activityType: 'logging_failure',
                    accessType: 'admin',
                    targetId: fallbackMetadata.targetId || 'unknown',
                    targetName: fallbackMetadata.targetName || 'unknown',
                    ipAddress: undefined,
                    userAgent: undefined,
                    metadata: {
                        originalOperation: operationName,
                        error: error instanceof Error ? error.message : String(error),
                        fallbackMetadata
                    }
                });
            } catch (fallbackError) {
                console.error('[CRITICAL] Even fallback logging failed:', fallbackError);
            }
        }
        
        return null;
    }
}

/**
 * Standardized logging for API operations with consistent error handling
 */
export async function logApiOperation(
    db: D1Database,
    operation: {
        logType: string;
        userEmail: string;
        tenantId?: string;
        activityType?: string;
        accessType?: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    const normalizedLogging = new NormalizedLogging(db);
    
    const result = await safeLog(
        () => normalizedLogging.logSystemOperations({
            userEmail: operation.userEmail,
            tenantId: operation.tenantId || 'system',
            activityType: operation.activityType || 'api_operation',
            accessType: (operation.accessType as any) || 'admin',
            targetId: operation.targetId,
            targetName: operation.targetName,
            ipAddress: operation.ipAddress,
            userAgent: operation.userAgent,
            metadata: operation.metadata
        }),
        `${operation.logType}_${operation.activityType || operation.accessType || 'operation'}`,
        {
            userEmail: operation.userEmail,
            targetId: operation.targetId,
            targetName: operation.targetName,
            logType: operation.logType
        }
    );
    
    return result;
}

/**
 * Extract common request context (IP, User Agent) from a request
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
 * Create standardized metadata for common operations
 */
export function createOperationMetadata(
    operation: string,
    additionalData?: Record<string, any>
): Record<string, any> {
    return {
        operation,
        timestamp: new Date().toISOString(),
        ...additionalData
    };
}

/**
 * Log authentication events with consistent pattern
 */
export async function logAuthEvent(
    db: D1Database,
    event: {
        userEmail: string;
        activityType: string;
        targetId?: string;
        targetName?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    return logApiOperation(db, {
        logType: 'authentication',
        userEmail: event.userEmail,
        activityType: event.activityType,
        targetId: event.targetId || 'auth',
        targetName: event.targetName || 'authentication',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata
    });
}

/**
 * Log media access events with consistent pattern
 */
export async function logMediaAccessEvent(
    db: D1Database,
    event: {
        userEmail: string;
        tenantId?: string;
        accessType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    return logApiOperation(db, {
        logType: 'media_access',
        userEmail: event.userEmail,
        tenantId: event.tenantId,
        accessType: event.accessType,
        targetId: event.targetId,
        targetName: event.targetName,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata
    });
}

/**
 * Log activity events with consistent pattern
 */
export async function logActivityEvent(
    db: D1Database,
    event: {
        userEmail: string;
        tenantId?: string;
        activityType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    return logApiOperation(db, {
        logType: 'activity',
        userEmail: event.userEmail,
        tenantId: event.tenantId,
        activityType: event.activityType,
        targetId: event.targetId,
        targetName: event.targetName,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata
    });
}

/**
 * Log messaging events with consistent pattern
 */
export async function logMessagingEvent(
    db: D1Database,
    event: {
        userEmail: string;
        tenantId?: string;
        activityType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    return logApiOperation(db, {
        logType: 'messaging',
        userEmail: event.userEmail,
        tenantId: event.tenantId,
        activityType: event.activityType,
        targetId: event.targetId,
        targetName: event.targetName,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata
    });
}

/**
 * Log avatar events with consistent pattern
 */
export async function logAvatarEvent(
    db: D1Database,
    event: {
        userEmail: string;
        tenantId?: string;
        accessType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }
): Promise<number | null> {
    return logApiOperation(db, {
        logType: 'avatar_access',
        userEmail: event.userEmail,
        tenantId: event.tenantId,
        accessType: event.accessType,
        targetId: event.targetId,
        targetName: event.targetName,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata
    });
}

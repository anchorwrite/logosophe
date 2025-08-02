import { getCloudflareContext } from "@opennextjs/cloudflare";

// LogType is a TEXT field in the database, so we'll use string
export type LogType = string;

export interface SystemLog {
    id?: number;
    logType: LogType;
    timestamp: string;
    userId?: string;
    userEmail?: string;
    provider?: string;
    tenantId?: string;
    activityType?: string;
    accessType?: string;
    targetId?: string;
    targetName?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    isDeleted?: boolean;
}

export interface LogQueryParams {
    logType?: LogType;
    activityType?: string;
    startDate?: string;
    endDate?: string;
    userEmail?: string;
    tenantId?: string;
    targetId?: string;
    search?: string;
    ipAddress?: string;
    limit?: number;
    offset?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

export class SystemLogs {
    constructor(private db: D1Database) {}

    async createLog(log: Omit<SystemLog, 'id'>): Promise<number> {
        const { 
            logType, 
            timestamp = new Date().toISOString(), 
            userId, 
            userEmail, 
            provider, 
            tenantId, 
            activityType, 
            accessType, 
            targetId, 
            targetName, 
            ipAddress, 
            userAgent, 
            metadata, 
            isDeleted = false 
        } = log;

        const result = await this.db.prepare(`
            INSERT INTO SystemLogs (
                LogType, Timestamp, UserId, UserEmail, Provider, TenantId,
                ActivityType, AccessType, TargetId, TargetName,
                IpAddress, UserAgent, Metadata, IsDeleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            logType,
            timestamp,
            userId || null,
            userEmail || null,
            provider || null,
            tenantId || null,
            activityType || null,
            accessType || null,
            targetId || null,
            targetName || null,
            ipAddress || null,
            userAgent || null,
            metadata ? JSON.stringify(metadata) : null,
            isDeleted ? 1 : 0
        ).run();

        return result.meta.last_row_id;
    }

    async queryLogs(params: LogQueryParams): Promise<{ logs: SystemLog[], totalCount: number }> {
        const conditions: string[] = ['IsDeleted = 0']; // Only show non-deleted logs
        const bindings: any[] = [];

        if (params.logType) {
            conditions.push('LogType = ?');
            bindings.push(params.logType);
        }

        if (params.activityType) {
            conditions.push('ActivityType = ?');
            bindings.push(params.activityType);
        }

        if (params.startDate) {
            conditions.push('Timestamp >= ?');
            bindings.push(params.startDate);
        }

        if (params.endDate) {
            conditions.push('Timestamp <= ?');
            bindings.push(params.endDate);
        }

        if (params.userEmail) {
            conditions.push('UserEmail = ?');
            bindings.push(params.userEmail);
        }

        if (params.tenantId) {
            conditions.push('TenantId = ?');
            bindings.push(params.tenantId);
        }

        if (params.targetId) {
            conditions.push('TargetId = ?');
            bindings.push(params.targetId);
        }

        if (params.search) {
            conditions.push('(TargetName LIKE ? OR UserEmail LIKE ? OR ActivityType LIKE ? OR TargetId LIKE ?)');
            bindings.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
        }

        if (params.ipAddress) {
            conditions.push('IpAddress = ?');
            bindings.push(params.ipAddress);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        // Get total count first
        const countResult = await this.db.prepare(`
            SELECT COUNT(*) as count FROM SystemLogs
            ${whereClause}
        `).bind(...bindings).first();
        const totalCount = countResult ? (countResult as any).count : 0;

        // Map sort field to database column
        const sortFieldMap: Record<string, string> = {
            timestamp: 'Timestamp',
            logType: 'LogType',
            userEmail: 'UserEmail',
            tenantId: 'TenantId',
            activityType: 'ActivityType',
            accessType: 'AccessType',
            targetId: 'TargetId',
            targetName: 'TargetName',
            ipAddress: 'IpAddress'
        };

        const dbSortField = sortFieldMap[params.sortField || 'timestamp'] || 'Timestamp';
        const dbSortOrder = params.sortOrder?.toUpperCase() || 'DESC';

        let query = `
            SELECT 
                Id,
                LogType,
                Timestamp,
                UserId,
                UserEmail,
                Provider,
                TenantId,
                ActivityType,
                AccessType,
                TargetId,
                TargetName,
                IpAddress,
                UserAgent,
                Metadata,
                IsDeleted
            FROM SystemLogs
            ${whereClause}
            ORDER BY ${dbSortField} ${dbSortOrder}
        `;

        // Only add LIMIT and OFFSET if they are provided
        if (params.limit !== undefined) {
            query += ` LIMIT ? OFFSET ?`;
            bindings.push(params.limit, params.offset || 0);
        }

        const result = await this.db.prepare(query)
            .bind(...bindings)
            .all();

        return {
            logs: result.results.map((row: any) => ({
                id: row.Id,
                logType: row.LogType,
                timestamp: row.Timestamp,
                userId: row.UserId || undefined,
                userEmail: row.UserEmail || undefined,
                provider: row.Provider || undefined,
                tenantId: row.TenantId || undefined,
                activityType: row.ActivityType || undefined,
                accessType: row.AccessType || undefined,
                targetId: row.TargetId || undefined,
                targetName: row.TargetName || undefined,
                ipAddress: row.IpAddress || undefined,
                userAgent: row.UserAgent || undefined,
                metadata: row.Metadata ? JSON.parse(row.Metadata) : undefined,
                isDeleted: Boolean(row.IsDeleted)
            })),
            totalCount
        };
    }

    // Helper functions for specific log types
    async logActivity(data: {
        userId: string;
        email: string;
        provider: string;
        activityType: string;
        tenantId?: string;
        targetId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'ACTIVITY',
            timestamp: new Date().toISOString(),
            userId: data.userId,
            userEmail: data.email,
            provider: data.provider,
            activityType: data.activityType,
            tenantId: data.tenantId,
            targetId: data.targetId,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }

    async logAuth(data: {
        userId: string;
        email: string;
        provider: string;
        activityType: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'AUTH',
            timestamp: new Date().toISOString(),
            userId: data.userId,
            userEmail: data.email,
            provider: data.provider,
            activityType: data.activityType,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }

    async logMediaShare(data: {
        userEmail: string;
        tenantId?: string;
        accessType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<number> {
        return this.createLog({
            logType: 'MEDIA_SHARE',
            timestamp: new Date().toISOString(),
            userEmail: data.userEmail,
            tenantId: data.tenantId,
            accessType: data.accessType,
            targetId: data.targetId,
            targetName: data.targetName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            isDeleted: false
        });
    }

    async logMediaAccess(data: {
        userEmail: string;
        tenantId?: string;
        accessType: string;
        targetId: string;
        targetName: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'MEDIA_ACCESS',
            timestamp: new Date().toISOString(),
            userEmail: data.userEmail,
            tenantId: data.tenantId,
            accessType: data.accessType,
            targetId: data.targetId,
            targetName: data.targetName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }

    async logTenantOperation(data: {
        userEmail: string;
        activityType: string;
        targetId: string;
        targetName: string;
        tenantId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'ACTIVITY',
            timestamp: new Date().toISOString(),
            userEmail: data.userEmail,
            tenantId: data.tenantId,
            activityType: data.activityType,
            targetId: data.targetId,
            targetName: data.targetName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }

    async logUserOperation(data: {
        userEmail: string;
        activityType: string;
        targetId: string;
        targetName: string;
        tenantId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'ACTIVITY',
            timestamp: new Date().toISOString(),
            userEmail: data.userEmail,
            tenantId: data.tenantId,
            activityType: data.activityType,
            targetId: data.targetId,
            targetName: data.targetName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }

    async logMessagingOperation(data: {
        userEmail: string;
        activityType: string;
        targetId: string;
        targetName: string;
        tenantId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<number> {
        return this.createLog({
            logType: 'MESSAGING',
            timestamp: new Date().toISOString(),
            userEmail: data.userEmail,
            tenantId: data.tenantId,
            activityType: data.activityType,
            targetId: data.targetId,
            targetName: data.targetName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            isDeleted: false
        });
    }
} 
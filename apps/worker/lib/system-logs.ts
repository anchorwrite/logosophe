import { getCloudflareContext } from "@opennextjs/cloudflare";

export type LogType = 'auth' | 'activity' | 'media_access' | 'media_share';

export interface SystemLog {
  id?: number;
  timestamp: string;
  logType: LogType;
  userId: string;
  userEmail: string;
  provider: string;
  activityType: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
}

export class SystemLogs {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async createLog(log: Omit<SystemLog, 'id'>): Promise<number> {
    const { results } = await this.db.prepare(`
      INSERT INTO SystemLogs (Timestamp, LogType, UserId, UserEmail, Provider, ActivityType, IpAddress, UserAgent, Metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      log.timestamp,
      log.logType,
      log.userId,
      log.userEmail,
      log.provider,
      log.activityType,
      log.ipAddress,
      log.userAgent,
      JSON.stringify(log.metadata || {})
    ).run();

    return results?.id || 0;
  }

  async logAuth(data: {
    userId: string;
    email: string;
    provider: string;
    activityType: 'signin' | 'signout';
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    return this.createLog({
      timestamp: new Date().toISOString(),
      logType: 'auth',
      userId: data.userId,
      userEmail: data.email,
      provider: data.provider,
      activityType: data.activityType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata
    });
  }

  async logActivity(data: {
    userId: string;
    email: string;
    provider: string;
    activityType: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    return this.createLog({
      timestamp: new Date().toISOString(),
      logType: 'activity',
      userId: data.userId,
      userEmail: data.email,
      provider: data.provider,
      activityType: data.activityType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata
    });
  }

  async logMediaAccess(data: {
    userId: string;
    email: string;
    provider: string;
    activityType: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    return this.createLog({
      timestamp: new Date().toISOString(),
      logType: 'media_access',
      userId: data.userId,
      userEmail: data.email,
      provider: data.provider,
      activityType: data.activityType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata
    });
  }

  async logMediaShare(data: {
    userId: string;
    email: string;
    provider: string;
    activityType: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    return this.createLog({
      timestamp: new Date().toISOString(),
      logType: 'media_share',
      userId: data.userId,
      userEmail: data.email,
      provider: data.provider,
      activityType: data.activityType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata
    });
  }
} 
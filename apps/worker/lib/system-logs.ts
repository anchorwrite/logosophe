import { getCloudflareContext } from "@opennextjs/cloudflare";

export type LogType = 'auth' | 'activity' | 'media_access' | 'media_share';

export interface SystemLog {
  id?: number;
  timestamp: string;
  type: LogType;
  userId: string;
  email: string;
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
      INSERT INTO SystemLogs (Timestamp, Type, UserId, Email, Provider, ActivityType, IpAddress, UserAgent, Metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      log.timestamp,
      log.type,
      log.userId,
      log.email,
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
      type: 'auth',
      ...data
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
      type: 'activity',
      ...data
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
      type: 'media_access',
      ...data
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
      type: 'media_share',
      ...data
    });
  }
} 
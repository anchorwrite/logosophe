import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface WorkflowHistoryEvent {
  workflowId: string;
  tenantId: string;
  initiatorEmail: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  eventType: 'created' | 'updated' | 'completed' | 'terminated' | 'deleted' | 'reactivated' | 'permanently_deleted';
  eventTimestamp: string;
  eventPerformedBy: string;
}

export class WorkflowHistoryLogger {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async logWorkflowEvent(event: WorkflowHistoryEvent): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO WorkflowHistory (
          Id, WorkflowId, TenantId, InitiatorEmail, Title, Status, 
          CreatedAt, UpdatedAt, CompletedAt, CompletedBy, 
          DeletedAt, DeletedBy, EventType, EventTimestamp, EventPerformedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const historyId = `${event.workflowId}_${event.eventType}_${Date.now()}`;

      await this.db.prepare(insertQuery).bind(
        historyId,
        event.workflowId,
        event.tenantId,
        event.initiatorEmail,
        event.title,
        event.status,
        event.createdAt,
        event.updatedAt,
        event.completedAt || null,
        event.completedBy || null,
        event.deletedAt || null,
        event.deletedBy || null,
        event.eventType,
        event.eventTimestamp,
        event.eventPerformedBy
      ).run();

      console.log(`WorkflowHistory logged: ${event.eventType} for workflow ${event.workflowId}`);
    } catch (error) {
      console.error('Failed to log to WorkflowHistory:', error);
      // Don't throw - we don't want to break workflow operations if history logging fails
    }
  }

  async logWorkflowCreated(workflowData: any, performedBy: string): Promise<void> {
    const event: WorkflowHistoryEvent = {
      workflowId: workflowData.Id,
      tenantId: workflowData.TenantId,
      initiatorEmail: workflowData.InitiatorEmail,
      title: workflowData.Title,
      status: workflowData.Status,
      createdAt: workflowData.CreatedAt,
      updatedAt: workflowData.UpdatedAt,
      completedAt: workflowData.CompletedAt,
      completedBy: workflowData.CompletedBy,
      eventType: 'created',
      eventTimestamp: new Date().toISOString(),
      eventPerformedBy: performedBy
    };

    await this.logWorkflowEvent(event);
  }

  async logWorkflowUpdated(workflowData: any, performedBy: string, action?: string): Promise<void> {
    const event: WorkflowHistoryEvent = {
      workflowId: workflowData.Id,
      tenantId: workflowData.TenantId,
      initiatorEmail: workflowData.InitiatorEmail,
      title: workflowData.Title,
      status: workflowData.Status,
      createdAt: workflowData.CreatedAt,
      updatedAt: workflowData.UpdatedAt,
      completedAt: workflowData.CompletedAt,
      completedBy: workflowData.CompletedBy,
      eventType: action === 'complete' ? 'completed' : 
                 action === 'terminate' ? 'terminated' : 
                 action === 'reactivate' ? 'reactivated' : 'updated',
      eventTimestamp: new Date().toISOString(),
      eventPerformedBy: performedBy
    };

    await this.logWorkflowEvent(event);
  }

  async logWorkflowDeleted(workflowData: any, performedBy: string): Promise<void> {
    const event: WorkflowHistoryEvent = {
      workflowId: workflowData.Id,
      tenantId: workflowData.TenantId,
      initiatorEmail: workflowData.InitiatorEmail,
      title: workflowData.Title,
      status: workflowData.Status,
      createdAt: workflowData.CreatedAt,
      updatedAt: workflowData.UpdatedAt,
      completedAt: workflowData.CompletedAt,
      completedBy: workflowData.CompletedBy,
      deletedAt: new Date().toISOString(),
      deletedBy: performedBy,
      eventType: 'deleted',
      eventTimestamp: new Date().toISOString(),
      eventPerformedBy: performedBy
    };

    await this.logWorkflowEvent(event);
  }

  async logWorkflowPermanentlyDeleted(workflowData: any, performedBy: string): Promise<void> {
    const event: WorkflowHistoryEvent = {
      workflowId: workflowData.Id,
      tenantId: workflowData.TenantId,
      initiatorEmail: workflowData.InitiatorEmail,
      title: workflowData.Title,
      status: workflowData.Status,
      createdAt: workflowData.CreatedAt,
      updatedAt: workflowData.UpdatedAt,
      completedAt: workflowData.CompletedAt,
      completedBy: workflowData.CompletedBy,
      deletedAt: workflowData.DeletedAt || new Date().toISOString(),
      deletedBy: workflowData.DeletedBy || performedBy,
      eventType: 'permanently_deleted',
      eventTimestamp: new Date().toISOString(),
      eventPerformedBy: performedBy
    };

    await this.logWorkflowEvent(event);
  }
}

// Helper function to get WorkflowHistoryLogger instance
export async function getWorkflowHistoryLogger(): Promise<WorkflowHistoryLogger> {
  const { env } = await getCloudflareContext({async: true});
  return new WorkflowHistoryLogger(env.DB);
} 
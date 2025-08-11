import { broadcastToTenant, broadcastToMultipleTenants, broadcastToAllTenants } from './messaging-events-broadcaster';

// Event types for messaging system
export type MessageEventType = 
  | 'message:new'
  | 'message:read'
  | 'message:delete'
  | 'message:update'
  | 'message:attachment:added'
  | 'message:attachment:removed'
  | 'message:link:added'
  | 'message:link:removed'
  | 'connection:established';

// Base event data structure
export interface BaseEventData {
  messageId?: number;
  tenantId?: string;
  userEmail?: string;
  timestamp?: string;
  [key: string]: any;
}

// Specific event data types
export interface MessageNewEventData extends BaseEventData {
  messageId: number;
  tenantId: string;
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string; // Note: database uses 'Body' not 'Content'
  hasAttachments: boolean;
  attachmentCount: number;
}

export interface MessageReadEventData extends BaseEventData {
  messageId: number;
  tenantId: string;
  readBy: string;
  readAt: string;
}

export interface MessageAttachmentEventData extends BaseEventData {
  messageId: number;
  tenantId: string;
  attachmentId: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  attachmentType: 'media_library' | 'upload';
  mediaId: number; // Database column name
}

export interface MessageLinkEventData extends BaseEventData {
  messageId: number;
  tenantId: string;
  linkId: number;
  url: string;
  title?: string;
  domain: string;
}

// Event broadcasting functions
export class MessagingEventBroadcaster {
  
  /**
   * Broadcast a new message event to a specific tenant
   */
  static broadcastMessageNew(tenantId: string, eventData: MessageNewEventData) {
    broadcastToTenant(tenantId, 'message:new', eventData);
  }

  /**
   * Broadcast a message read event to a specific tenant
   */
  static broadcastMessageRead(tenantId: string, eventData: MessageReadEventData) {
    broadcastToTenant(tenantId, 'message:read', eventData);
  }

  /**
   * Broadcast a message delete event to a specific tenant
   */
  static broadcastMessageDelete(tenantId: string, eventData: BaseEventData) {
    broadcastToTenant(tenantId, 'message:delete', eventData);
  }

  /**
   * Broadcast a message update event to a specific tenant
   */
  static broadcastMessageUpdate(tenantId: string, eventData: BaseEventData) {
    broadcastToTenant(tenantId, 'message:update', eventData);
  }

  /**
   * Broadcast an attachment added event to a specific tenant
   */
  static broadcastAttachmentAdded(tenantId: string, eventData: MessageAttachmentEventData) {
    broadcastToTenant(tenantId, 'message:attachment:added', eventData);
  }

  /**
   * Broadcast an attachment removed event to a specific tenant
   */
  static broadcastAttachmentRemoved(tenantId: string, eventData: MessageAttachmentEventData) {
    broadcastToTenant(tenantId, 'message:attachment:removed', eventData);
  }

  /**
   * Broadcast a link added event to a specific tenant
   */
  static broadcastLinkAdded(tenantId: string, eventData: MessageLinkEventData) {
    broadcastToTenant(tenantId, 'message:link:added', eventData);
  }

  /**
   * Broadcast a link removed event to a specific tenant
   */
  static broadcastLinkRemoved(tenantId: string, eventData: MessageLinkEventData) {
    broadcastToTenant(tenantId, 'message:link:removed', eventData);
  }

  /**
   * Broadcast a new message to multiple tenants (for admin broadcast messages)
   */
  static broadcastMessageNewToMultipleTenants(tenantIds: string[], eventData: MessageNewEventData) {
    broadcastToMultipleTenants(tenantIds, 'message:new', eventData);
  }

  /**
   * Broadcast a new message to all tenants (for global admin messages)
   */
  static broadcastMessageNewToAllTenants(eventData: MessageNewEventData) {
    broadcastToAllTenants('message:new', eventData);
  }

  /**
   * Broadcast system-wide events to all tenants
   */
  static broadcastSystemEvent(eventType: string, eventData: BaseEventData) {
    broadcastToAllTenants(eventType, eventData);
  }
}

// Helper function to create event data with common fields
export function createEventData(
  messageId: number,
  tenantId: string,
  userEmail: string,
  additionalData: Record<string, any> = {}
): BaseEventData {
  return {
    messageId,
    tenantId,
    userEmail,
    timestamp: new Date().toISOString(),
    ...additionalData
  };
}

// Helper function to create message new event data
export function createMessageNewEventData(
  messageId: number,
  tenantId: string,
  senderEmail: string,
  recipients: string[],
  subject: string,
  body: string, // Note: database uses 'Body' not 'Content'
  hasAttachments: boolean = false,
  attachmentCount: number = 0
): MessageNewEventData {
  return {
    messageId,
    tenantId,
    senderEmail,
    recipients,
    subject,
    body,
    hasAttachments,
    attachmentCount,
    timestamp: new Date().toISOString()
  };
}

export function createMessageReadEventData(
  messageId: number,
  tenantId: string,
  readBy: string,
  readAt: string
): MessageReadEventData {
  return {
    messageId,
    tenantId,
    readBy,
    readAt,
    timestamp: new Date().toISOString()
  };
}

// Helper function to create attachment event data
export function createAttachmentEventData(
  messageId: number,
  tenantId: string,
  attachmentId: number,
  fileName: string,
  fileSize: number,
  contentType: string,
  attachmentType: 'media_library' | 'upload',
  mediaId: number // Database column name
): MessageAttachmentEventData {
  return {
    messageId,
    tenantId,
    attachmentId,
    fileName,
    fileSize,
    contentType,
    attachmentType,
    mediaId,
    timestamp: new Date().toISOString()
  };
}

// Helper function to create link event data
export function createLinkEventData(
  messageId: number,
  tenantId: string,
  linkId: number,
  url: string,
  title: string | undefined,
  domain: string
): MessageLinkEventData {
  return {
    messageId,
    tenantId,
    linkId,
    url,
    title,
    domain,
    timestamp: new Date().toISOString()
  };
}

// Messaging system types

export interface Message {
  Id: number;
  SenderEmail: string;
  Subject: string;
  Body: string; // Note: database uses 'Body' not 'Content'
  TenantId: string;
  MessageType: string;
  Priority: string;
  CreatedAt: string;
  ExpiresAt?: string;
  IsDeleted: boolean;
  IsRecalled: boolean;
  RecalledAt?: string;
  RecallReason?: string;
  IsArchived: boolean;
  ArchivedAt?: string;
  DeletedAt?: string;
  HasAttachments: boolean;
  AttachmentCount: number;
}

export interface MessageRecipient {
  Id: number;
  MessageId: number;
  RecipientEmail: string;
  IsRead: boolean;
  ReadAt?: string;
  IsDeleted: boolean;
  DeletedAt?: string;
  TenantId: string;
}

export interface MessageAttachment {
  Id: number;
  MessageId: number;
  MediaId: number; // Note: database uses 'MediaId' not 'MediaFileId'
  AttachmentType: 'media_library' | 'upload';
  FileName: string;
  FileSize: number;
  ContentType: string;
  CreatedAt: string;
}

export interface MessageLink {
  Id: number;
  MessageId: number;
  Url: string;
  Title?: string;
  Description?: string;
  ThumbnailUrl?: string;
  Domain: string;
  CreatedAt: string;
}

export interface MessageWithRecipients extends Message {
  recipients: MessageRecipient[];
  attachments: MessageAttachment[];
  links: MessageLink[];
}

export interface CreateMessageRequest {
  subject: string;
  body: string; // Note: database uses 'Body' not 'Content'
  recipients: string[];
  tenantId: string;
  messageType: 'direct' | 'broadcast' | 'announcement';
  priority?: string;
  attachments?: CreateAttachmentRequest[];
  links?: CreateLinkRequest[];
}

export interface CreateAttachmentRequest {
  mediaId?: number; // For media library files - database uses 'MediaId'
  file?: File; // For desktop uploads
  attachmentType: 'media_library' | 'upload';
}

export interface CreateLinkRequest {
  url: string;
}

export interface RecallMessageRequest {
  reason?: string;
}

export interface BlockUserRequest {
  blockedEmail: string;
  tenantId: string;
  reason?: string;
}

export interface UnblockUserRequest {
  blockedEmail: string;
  tenantId: string;
}

export interface GetUserBlocksResponse {
  blocks: Array<{
    BlockerEmail: string;
    BlockedEmail: string;
    TenantId: string;
    Reason?: string;
    CreatedAt: string;
    IsActive: boolean;
    BlockerUserName?: string;
    BlockedUserName?: string;
  }>;
  blockedBy: Array<{
    BlockerEmail: string;
    BlockedEmail: string;
    TenantId: string;
    Reason?: string;
    CreatedAt: string;
    IsActive: boolean;
    BlockerUserName?: string;
    BlockedUserName?: string;
  }>;
}

export interface SystemSetting {
  Key: string;
  Value: string;
  UpdatedAt?: string;
  UpdatedBy?: string;
}

export interface SystemControlRequest {
  action: string;
  value: string;
}

export interface GetSystemStatusResponse {
  messagingEnabled: boolean;
  rateLimitSeconds: number;
  maxRecipients: number;
  recallWindowSeconds: number;
  messageExpirySeconds: number;
  totalMessages: number;
  activeUsers: number;
  blockedUsers: number;
}

export interface GetRecipientsResponse {
  users: Array<{
    email: string;
    name?: string;
    tenantId: string;
    roleId: string;
    isOnline: boolean;
    isBlocked: boolean;
    isActive: boolean;
    isBanned: boolean;
  }>;
  tenants: Array<{
    id: string;
    name: string;
    userCount: number;
  }>;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: number;
  error?: string;
  message?: string;
}

export interface GetMessagesRequest {
  tenantId: string;
  page?: number;
  pageSize?: number;
  status?: 'all' | 'unread' | 'read' | 'sent' | 'deleted' | 'recalled';
  search?: string;
}

export interface GetMessagesResponse {
  messages: MessageResponse[];
  totalCount: number;
  unreadCount: number;
}

export interface MessageAttachmentResponse {
  id: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  attachmentType: 'media_library' | 'upload';
  mediaId: number; // Database column name
  downloadUrl?: string;
  previewUrl?: string;
}

export interface MessageLinkResponse {
  id: number;
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  domain: string;
}

export interface MessageResponse {
  id: number;
  senderEmail: string;
  subject: string;
  body: string; // Note: database uses 'Body' not 'Content'
  tenantId: string;
  messageType: string;
  priority: string;
  createdAt: string;
  expiresAt?: string;
  isDeleted: boolean;
  isRecalled: boolean;
  recalledAt?: string;
  recallReason?: string;
  isArchived: boolean;
  archivedAt?: string;
  deletedAt?: string;
  hasAttachments: boolean;
  attachmentCount: number;
  recipients: MessageRecipient[];
  attachments: MessageAttachmentResponse[];
  links: MessageLinkResponse[];
}

export interface UnreadMessageCount {
  count: number;
  tenantId: string;
  lastUpdated: string;
}

export interface MessageStats {
  totalMessages: number;
  unreadMessages: number;
  sentMessages: number;
  receivedMessages: number;
  attachmentsCount: number;
  linksCount: number;
}

// SSE Event types
export interface SSEConnectionEstablished {
  type: 'connection:established';
  data: {
    tenantId: string;
    userEmail: string;
    timestamp: string;
  };
}

export interface SSEMessageNew {
  type: 'message:new';
  data: {
    messageId: number;
    tenantId: string;
    senderEmail: string;
    recipients: string[];
    subject: string;
    body: string; // Note: database uses 'Body' not 'Content'
    hasAttachments: boolean;
    attachmentCount: number;
    timestamp: string;
  };
}

export interface SSEMessageRead {
  type: 'message:read';
  data: {
    messageId: number;
    tenantId: string;
    readBy: string;
    readAt: string;
    timestamp: string;
  };
}

export interface SSEMessageDelete {
  type: 'message:delete';
  data: {
    messageId: number;
    tenantId: string;
    deletedBy: string;
    timestamp: string;
  };
}

export interface SSEMessageUpdate {
  type: 'message:update';
  data: {
    messageId: number;
    tenantId: string;
    updatedBy: string;
    changes: Record<string, any>;
    timestamp: string;
  };
}

export interface SSEAttachmentAdded {
  type: 'message:attachment:added';
  data: {
    messageId: number;
    tenantId: string;
    attachmentId: number;
    fileName: string;
    fileSize: number;
    contentType: string;
    attachmentType: 'media_library' | 'upload';
    mediaId: number; // Database column name
    timestamp: string;
  };
}

export interface SSEAttachmentRemoved {
  type: 'message:attachment:removed';
  data: {
    messageId: number;
    tenantId: string;
    attachmentId: number;
    fileName: string;
    timestamp: string;
  };
}

export interface SSELinkAdded {
  type: 'message:link:added';
  data: {
    messageId: number;
    tenantId: string;
    linkId: number;
    url: string;
    title?: string;
    domain: string;
    timestamp: string;
  };
}

export interface SSELinkRemoved {
  type: 'message:link:removed';
  data: {
    messageId: number;
    tenantId: string;
    linkId: number;
    url: string;
    timestamp: string;
  };
}

export interface SSEUnreadUpdate {
  type: 'unread:update';
  data: {
    count: number;
    timestamp: string;
  };
}

export type SSEEvent = 
  | SSEConnectionEstablished
  | SSEMessageNew
  | SSEMessageRead
  | SSEMessageDelete
  | SSEMessageUpdate
  | SSEAttachmentAdded
  | SSEAttachmentRemoved
  | SSELinkAdded
  | SSELinkRemoved
  | SSEUnreadUpdate;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MessageListResponse extends PaginatedResponse<MessageResponse> {
  stats: MessageStats;
}

// Error types
export interface MessagingError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Rate limiting types
export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: string;
  limit: number;
  waitSeconds?: number;
  retryAfter?: number;
}

// File upload types
export interface FileUploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadResult {
  success: boolean;
  mediaFileId?: number;
  error?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

// Link processing types
export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  domain: string;
  isValid: boolean;
  error?: string;
}

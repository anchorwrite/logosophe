// Messaging System Types

export interface Message {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  TenantId: string;
  MessageType: 'direct' | 'broadcast' | 'announcement';
  Priority: 'low' | 'normal' | 'high' | 'urgent';
  CreatedAt: string;
  ExpiresAt?: string;
  IsDeleted: boolean;
  IsRecalled: boolean;
  RecalledAt?: string;
  RecallReason?: string;
}

export interface MessageRecipient {
  Id: number;
  MessageId: number;
  RecipientEmail: string;
  IsRead: boolean;
  ReadAt?: string;
  IsDeleted: boolean;
  DeletedAt?: string;
  IsForwarded: boolean;
  ForwardedAt?: string;
  IsSaved: boolean;
  SavedAt?: string;
  IsReplied: boolean;
  RepliedAt?: string;
}

export interface MessageAttachment {
  Id: number;
  MessageId: number;
  MediaId: number;
  CreatedAt: string;
}

export interface MessageThread {
  Id: number;
  ParentMessageId?: number;
  ChildMessageId: number;
  CreatedAt: string;
}

export interface UserBlock {
  Id: number;
  BlockerEmail: string;
  BlockedEmail: string;
  TenantId: string;
  Reason?: string;
  CreatedAt: string;
  IsActive: boolean;
}

export interface MessageRateLimit {
  Id: number;
  SenderEmail: string;
  LastMessageAt: string;
  MessageCount: number;
  ResetAt: string;
}

export interface SystemSetting {
  Key: string;
  Value: string;
  UpdatedAt: string;
  UpdatedBy: string;
}

export interface CreateMessageRequest {
  subject: string;
  body: string;
  recipients: string[];
  tenantId: string;
  messageType: 'direct' | 'broadcast' | 'announcement';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  attachments?: number[]; // MediaIds
  replyToMessageId?: number;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: number;
  error?: string;
  rateLimitInfo?: {
    allowed: boolean;
    waitSeconds: number;
  };
}

export interface GetMessagesRequest {
  page?: number;
  pageSize?: number;
  messageType?: 'inbox' | 'sent' | 'drafts';
  isRead?: boolean;
  search?: string;
  tenantId?: string;
}

export interface GetMessagesResponse {
  messages: (Message & {
    recipients: MessageRecipient[];
    attachments: MessageAttachment[];
    senderName?: string;
  })[];
  totalCount: number;
  unreadCount: number;
}

export interface MarkMessagesReadRequest {
  messageIds: number[];
}

export interface DeleteMessagesRequest {
  messageIds: number[];
}

export interface RecallMessageRequest {
  messageId: number;
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
  blocks: UserBlock[];
  blockedBy: UserBlock[];
}

export interface SystemControlRequest {
  action: 'toggle_system' | 'set_rate_limit' | 'set_max_recipients' | 'set_recall_window';
  value: string | boolean;
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
  users: {
    email: string;
    name?: string;
    tenantId: string;
    roleId: string;
    isOnline: boolean;
    isBlocked: boolean;
  }[];
  tenants: {
    id: string;
    name: string;
    userCount: number;
  }[];
}

export interface RateLimitInfo {
  allowed: boolean;
  waitSeconds: number;
  messageCount: number;
  resetAt: string;
} 
export interface RecentMessage {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  SenderName: string;
  CreatedAt: string;
  IsRead: boolean;
  MessageType: string;
  RecipientCount: number;
  TenantId: string;
}

export interface UserStats {
  totalMessages: number;
  unreadMessages: number;
  sentMessages: number;
  activeConversations: number;
}

export interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  BlockerEmail?: string;
}

export interface Tenant {
  Id: string;
  Name: string;
  UserCount: number;
}

export interface Role {
  TenantId: string;
  RoleId: string;
  UserCount: number;
}

export interface SystemSettings {
  messagingEnabled: boolean;
  rateLimitSeconds: number;
  maxRecipients: number;
  recallWindowSeconds: number;
  messageExpiryDays: number;
}

export interface MessageRecipient {
  Email: string;
  Name: string;
  IsRead: boolean;
  ReadAt: string | null;
}

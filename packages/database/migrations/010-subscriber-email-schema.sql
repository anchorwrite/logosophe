-- Migration 010: Subscriber Email System Schema
-- Adds email verification, unsubscribe tokens, and email tracking tables
-- All table names use PascalCase as per project requirements

-- Note: EmailVerified column already exists in Subscribers table (DATETIME type)
-- Add EmailPreferences column only if it doesn't exist
-- We'll handle this manually if needed

-- Create EmailVerifications table for email verification tokens
CREATE TABLE IF NOT EXISTS EmailVerifications (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Email TEXT NOT NULL,
  Token TEXT UNIQUE NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt DATETIME NOT NULL,
  VerifiedAt DATETIME,
  Attempts INTEGER DEFAULT 0,
  FOREIGN KEY (Email) REFERENCES Subscribers(Email)
);

-- Create UnsubscribeTokens table for secure unsubscribe functionality
CREATE TABLE IF NOT EXISTS UnsubscribeTokens (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Email TEXT NOT NULL,
  Token TEXT UNIQUE NOT NULL,
  EmailType TEXT NOT NULL, -- 'all' or specific type
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt DATETIME,
  UsedAt DATETIME,
  FOREIGN KEY (Email) REFERENCES Subscribers(Email)
);

-- Create SubscriberEmails table for email tracking and analytics
CREATE TABLE IF NOT EXISTS SubscriberEmails (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  EmailType TEXT NOT NULL,
  Subject TEXT NOT NULL,
  Content TEXT NOT NULL,
  SentTo TEXT NOT NULL, -- JSON array of recipient emails
  TenantId TEXT,
  RoleFilter TEXT,
  HandleId INTEGER, -- Link to specific handle for handle-specific emails
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  OpenedCount INTEGER DEFAULT 0,
  ClickedCount INTEGER DEFAULT 0,
  FOREIGN KEY (HandleId) REFERENCES SubscriberHandles(Id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON EmailVerifications(Email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON EmailVerifications(Token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON EmailVerifications(ExpiresAt);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_email ON UnsubscribeTokens(Email);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON UnsubscribeTokens(Token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_email_type ON UnsubscribeTokens(EmailType);

CREATE INDEX IF NOT EXISTS idx_subscriber_emails_type ON SubscriberEmails(EmailType);
CREATE INDEX IF NOT EXISTS idx_subscriber_emails_tenant ON SubscriberEmails(TenantId);
CREATE INDEX IF NOT EXISTS idx_subscriber_emails_handle ON SubscriberEmails(HandleId);
CREATE INDEX IF NOT EXISTS idx_subscriber_emails_sent_at ON SubscriberEmails(SentAt);

-- Migration: 014-better-auth-tables.sql
-- Description: Create Better Auth schema alongside existing Auth.js tables, backfill data
-- Created: 2026-04-10

-- =============================================================================
-- BETTER AUTH TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "role" TEXT,
    "banned" INTEGER DEFAULT 0,
    "banReason" TEXT,
    "banExpires" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TEXT,
    "refreshTokenExpiresAt" TEXT,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    UNIQUE ("providerId", "accountId")
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ba_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_ba_session_userId ON "session"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_ba_session_expiresAt ON "session"(expiresAt);
CREATE INDEX IF NOT EXISTS idx_ba_account_userId ON "account"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_account_provider ON "account"(providerId, accountId);
CREATE INDEX IF NOT EXISTS idx_ba_verification_identifier ON "verification"(identifier);
CREATE INDEX IF NOT EXISTS idx_ba_verification_expiresAt ON "verification"(expiresAt);


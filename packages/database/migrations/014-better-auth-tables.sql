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

-- =============================================================================
-- BACKFILL FROM AUTH.JS TABLES
-- Only runs if the Auth.js `users` table exists (it may be empty in local dev).
-- =============================================================================

-- user: copy from Auth.js users table, computing role from Credentials/Subscribers.
INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, image, role, createdAt, updatedAt)
SELECT
    u.id,
    u.name,
    u.email,
    CASE WHEN u.emailVerified IS NOT NULL THEN 1 ELSE 0 END,
    u.image,
    CASE
        WHEN c.Role IN ('admin', 'tenant') THEN c.Role
        WHEN s.Email IS NOT NULL THEN 'subscriber'
        ELSE 'user'
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users u
LEFT JOIN Credentials c ON c.Email = u.email
LEFT JOIN Subscribers s ON s.Email = u.email AND s.Active = TRUE AND s.EmailVerified IS NOT NULL
WHERE u.email IS NOT NULL;

-- account: copy OAuth accounts, remapping microsoft-entra-id → microsoft
INSERT OR IGNORE INTO "account" (id, userId, providerId, accountId, accessToken, refreshToken, idToken, accessTokenExpiresAt, scope, createdAt, updatedAt)
SELECT
    a.id,
    a.userId,
    CASE WHEN a.provider = 'microsoft-entra-id' THEN 'microsoft' ELSE a.provider END,
    a.providerAccountId,
    a.access_token,
    a.refresh_token,
    a.id_token,
    CASE WHEN a.expires_at IS NOT NULL THEN datetime(a.expires_at, 'unixepoch') ELSE NULL END,
    a.scope,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM accounts a
WHERE a.userId IN (SELECT id FROM "user");

-- account: backfill Credentials passwords (bcrypt hashes) as providerId='credential'
INSERT OR IGNORE INTO "account" (id, userId, providerId, accountId, password, createdAt, updatedAt)
SELECT
    lower(hex(randomblob(16))),
    u.id,
    'credential',
    c.Email,
    c.Password,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM Credentials c
JOIN "user" u ON u.email = c.Email
WHERE NOT EXISTS (
    SELECT 1 FROM "account" a WHERE a.userId = u.id AND a.providerId = 'credential'
);

-- Migration: 015-drop-authjs-tables.sql
-- Description: Drop legacy Auth.js v5 tables after Better Auth migration is verified
-- Created: 2026-04-10

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_emailVerified;
DROP INDEX IF EXISTS idx_accounts_userId;
DROP INDEX IF EXISTS idx_accounts_provider;
DROP INDEX IF EXISTS idx_accounts_providerAccountId;
DROP INDEX IF EXISTS idx_sessions_userId;
DROP INDEX IF EXISTS idx_sessions_sessionToken;
DROP INDEX IF EXISTS idx_sessions_expires;
DROP INDEX IF EXISTS idx_verificationToken_token;
DROP INDEX IF EXISTS idx_verificationToken_expires;

DROP TABLE IF EXISTS verificationToken;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

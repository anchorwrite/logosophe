-- Migration 012: Fix Individual Subscriber Handle Limits
-- Date: 2025-01-27
-- Description: Remove MaxHandles column and fix LimitType values to use tier system

-- First, update existing records to use proper tier values
UPDATE "IndividualSubscriberHandleLimits" 
SET "LimitType" = 'default' 
WHERE "LimitType" = 'custom';

-- Remove the MaxHandles column (SQLite doesn't support DROP COLUMN, so we recreate the table)
-- Create new table structure
CREATE TABLE "IndividualSubscriberHandleLimits_new" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "LimitType" TEXT NOT NULL, -- 'default', 'premium', 'enterprise'
    "Description" TEXT,
    "SetBy" TEXT NOT NULL, -- Email of admin who set this limit
    "SetAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" DATETIME, -- Optional expiration date
    "IsActive" BOOLEAN DEFAULT TRUE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("SetBy") REFERENCES "Credentials"("Email")
);

-- Copy data from old table to new table
INSERT INTO "IndividualSubscriberHandleLimits_new" (
    "Id", "SubscriberEmail", "LimitType", "Description", "SetBy", 
    "SetAt", "ExpiresAt", "IsActive", "CreatedAt", "UpdatedAt"
)
SELECT 
    "Id", "SubscriberEmail", "LimitType", "Description", "SetBy", 
    "SetAt", "ExpiresAt", "IsActive", "CreatedAt", "UpdatedAt"
FROM "IndividualSubscriberHandleLimits";

-- Drop old table and rename new one
DROP TABLE "IndividualSubscriberHandleLimits";
ALTER TABLE "IndividualSubscriberHandleLimits_new" RENAME TO "IndividualSubscriberHandleLimits";

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_individual_handle_limits_email" ON "IndividualSubscriberHandleLimits"("SubscriberEmail");
CREATE INDEX IF NOT EXISTS "idx_individual_handle_limits_set_by" ON "IndividualSubscriberHandleLimits"("SetBy");
CREATE INDEX IF NOT EXISTS "idx_individual_handle_limits_active" ON "IndividualSubscriberHandleLimits"("IsActive", "ExpiresAt");

-- Update comment to reflect new structure
-- Individual limits now use tier system: default (1), premium (3), enterprise (10)
-- Priority order: Individual > Global Tier > Default (1 handle)

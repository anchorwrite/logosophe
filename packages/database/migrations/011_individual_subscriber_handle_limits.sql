-- Migration 011: Individual Subscriber Handle Limits
-- Date: 2025-01-27
-- Description: Add support for individual subscriber handle limits beyond global tiers

-- Create table for individual subscriber handle limits
CREATE TABLE IF NOT EXISTS "IndividualSubscriberHandleLimits" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "MaxHandles" INTEGER NOT NULL,
    "LimitType" TEXT NOT NULL, -- 'custom', 'premium', 'enterprise'
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

-- Create unique index on subscriber email (one limit per subscriber)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_individual_handle_limits_email" ON "IndividualSubscriberHandleLimits"("SubscriberEmail");

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS "idx_individual_handle_limits_set_by" ON "IndividualSubscriberHandleLimits"("SetBy");

-- Create index for active limits
CREATE INDEX IF NOT EXISTS "idx_individual_handle_limits_active" ON "IndividualSubscriberHandleLimits"("IsActive", "ExpiresAt");

-- Add comment to document the priority system
-- Individual limits take precedence over global tier limits
-- Priority order: Individual > Global Tier > Default (1 handle)

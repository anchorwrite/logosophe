-- Migration: 013_add_ispublic_to_subscriber_announcements.sql
-- Description: Add IsPublic column to SubscriberAnnouncements table
-- Created: 2025-08-31
-- Status: New migration to sync local and production schemas

-- Add IsPublic column to SubscriberAnnouncements table
ALTER TABLE "SubscriberAnnouncements" ADD COLUMN "IsPublic" BOOLEAN DEFAULT TRUE;

-- Update existing announcements to be public by default
UPDATE "SubscriberAnnouncements" SET "IsPublic" = TRUE WHERE "IsPublic" IS NULL;

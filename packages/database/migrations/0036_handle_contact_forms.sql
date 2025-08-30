-- Migration 0036: Add contact form fields to SubscriberHandles table
-- This migration adds fields to enable per-handle contact forms

-- Add contact form fields to SubscriberHandles table
ALTER TABLE SubscriberHandles ADD COLUMN ContactFormEnabled BOOLEAN DEFAULT FALSE;
ALTER TABLE SubscriberHandles ADD COLUMN ContactEmail TEXT;

-- Create index for contact form queries
CREATE INDEX IF NOT EXISTS idx_subscriber_handles_contact_form ON SubscriberHandles(ContactFormEnabled, IsPublic);

-- Update existing handles to have contact forms disabled by default
-- (This is safe as it only sets a default value for new records)

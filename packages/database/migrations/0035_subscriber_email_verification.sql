-- Migration 0035: Add email verification and handle contact form support
-- Date: 2024-12-19
-- Description: Add email verification fields to Subscribers table and extend ContactSubmissions with handleId

-- Add verification fields to Subscribers table
ALTER TABLE Subscribers ADD COLUMN VerificationToken TEXT;
ALTER TABLE Subscribers ADD COLUMN VerificationExpires DATETIME;

-- Update EmailPreferences to simplified structure
UPDATE Subscribers SET EmailPreferences = '{"newsletters": true, "announcements": true, "tenant_updates": true}' 
WHERE EmailPreferences IS NOT NULL;

-- Add handleId field to ContactSubmissions table for handle-specific contact forms
ALTER TABLE ContactSubmissions ADD COLUMN HandleId INTEGER;
ALTER TABLE ContactSubmissions ADD COLUMN HandleEmail TEXT; -- Allow different email per handle

-- Create index for handle-specific contact form queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_handle ON ContactSubmissions(HandleId);

-- Create index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_verification_token ON Subscribers(VerificationToken);

-- Create index for verification expiration queries
CREATE INDEX IF NOT EXISTS idx_subscribers_verification_expires ON Subscribers(VerificationExpires);

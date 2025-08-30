-- Migration 0037: Remove duplicate contact form fields from SubscriberHandles
-- This migration removes the confusing ContactFormEnabled and ContactEmail fields
-- since contact forms will use the ContactInfo table instead

-- Remove the duplicate contact form fields
ALTER TABLE SubscriberHandles DROP COLUMN ContactFormEnabled;
ALTER TABLE SubscriberHandles DROP COLUMN ContactEmail;

-- Remove the index that was created for these fields
DROP INDEX IF EXISTS idx_subscriber_handles_contact_form;

-- Migration 0038: Add ContactFormEnabled field to SubscriberContactInfo table
-- This field controls whether contact forms are enabled for each handle

-- Add ContactFormEnabled field to SubscriberContactInfo table
ALTER TABLE SubscriberContactInfo ADD COLUMN ContactFormEnabled BOOLEAN DEFAULT FALSE;

-- Create index for contact form queries
CREATE INDEX IF NOT EXISTS idx_subscriber_contact_info_contact_form ON SubscriberContactInfo(ContactFormEnabled, IsActive);

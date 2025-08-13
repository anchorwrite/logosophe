-- Migration: Enhance MessageAttachments table to store file data directly
-- This separates messaging attachments from the publishing system's MediaFiles table

-- Add new columns to store file data directly (only the missing ones)
ALTER TABLE MessageAttachments ADD COLUMN R2Key TEXT;
ALTER TABLE MessageAttachments ADD COLUMN UploadDate TEXT;

-- Copy existing file data from MediaFiles for existing attachments
UPDATE MessageAttachments 
SET R2Key = (SELECT R2Key FROM MediaFiles WHERE MediaFiles.Id = MessageAttachments.MediaId),
    UploadDate = (SELECT UploadDate FROM MediaFiles WHERE MediaFiles.Id = MessageAttachments.MediaId)
WHERE MediaId IS NOT NULL;

-- Make the new columns NOT NULL after data migration
UPDATE MessageAttachments SET 
    R2Key = 'legacy_' || MediaId || '_' || COALESCE(FileName, 'legacy_file'),
    UploadDate = COALESCE(UploadDate, datetime('now'))
WHERE R2Key IS NULL;

-- Now we can remove the MediaId column since we have the data directly
-- But first, let's verify all data is migrated
-- ALTER TABLE MessageAttachments DROP COLUMN MediaId;

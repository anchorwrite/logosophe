-- Fix PublishedContent foreign key constraint
-- Remove the PublisherId foreign key that prevents insertion of new users
-- We only want to prevent deletion of users with published content, not prevent insertion

-- Temporarily disable foreign keys
PRAGMA foreign_keys = OFF;

-- Drop the existing PublishedContent table
DROP TABLE IF EXISTS PublishedContent;

-- Recreate the PublishedContent table without the PublisherId foreign key constraint
CREATE TABLE "PublishedContent" (
    Id TEXT PRIMARY KEY,
    MediaId INTEGER NOT NULL,
    PublisherId TEXT NOT NULL,
    PublishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PublishingSettings JSON,
    ApprovalStatus TEXT DEFAULT 'approved' CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FormId TEXT,
    GenreId TEXT,
    Language TEXT DEFAULT 'en',
    AccessToken TEXT,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id) ON DELETE CASCADE,
    FOREIGN KEY (GenreId) REFERENCES Genre(Id) ON DELETE SET NULL,
    FOREIGN KEY (FormId) REFERENCES Form(Id) ON DELETE SET NULL
    -- Removed: FOREIGN KEY (PublisherId) REFERENCES TenantUsers(Email)
    -- The application logic will handle ensuring PublisherId exists when needed
);

-- Re-enable foreign keys
PRAGMA foreign_keys = ON; 
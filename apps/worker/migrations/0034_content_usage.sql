-- Drop the existing ContentViews table
DROP TABLE IF EXISTS ContentViews;

-- Create ContentUsage table for tracking various content interactions
CREATE TABLE ContentUsage (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ContentId TEXT NOT NULL,
    UserEmail TEXT, -- NULL for anonymous users
    UsageType TEXT NOT NULL CHECK (UsageType IN ('view', 'download', 'favorite', 'comment', 'rating', 'share')),
    UsageData JSON, -- Flexible JSON field for additional data (rating value, comment text, etc.)
    IpAddress TEXT,
    UserAgent TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ContentId) REFERENCES PublishedContent(Id)
);

-- Create indexes for better performance
CREATE INDEX idx_content_usage_content ON ContentUsage(ContentId);
CREATE INDEX idx_content_usage_user ON ContentUsage(UserEmail);
CREATE INDEX idx_content_usage_type ON ContentUsage(UsageType);
CREATE INDEX idx_content_usage_created ON ContentUsage(CreatedAt); 
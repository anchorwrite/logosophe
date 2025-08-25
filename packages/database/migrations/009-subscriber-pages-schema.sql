-- Migration: 009-subscriber-pages-schema.sql
-- Description: Subscriber Pages database schema
-- Created: 2025-01-27
-- Status: New migration for subscriber pages feature

-- =============================================================================
-- SUBSCRIBER PAGES SCHEMA
-- =============================================================================

-- Subscriber Profiles (extending existing Subscribers table)
CREATE TABLE IF NOT EXISTS "SubscriberProfiles" (
    "Email" TEXT PRIMARY KEY,
    "Bio" TEXT,
    "PhotoUrl" TEXT,
    "Website" TEXT,
    "SocialLinks" TEXT, -- JSON array of social media links
    "Language" TEXT DEFAULT 'en',
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("Email") REFERENCES "Subscribers"("Email")
);

-- Handle Limits Configuration
CREATE TABLE IF NOT EXISTS "SubscriberHandleLimits" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "LimitType" TEXT UNIQUE NOT NULL, -- 'default', 'premium', 'enterprise'
    "MaxHandles" INTEGER NOT NULL DEFAULT 1,
    "Description" TEXT,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default handle limits
INSERT OR IGNORE INTO "SubscriberHandleLimits" ("LimitType", "MaxHandles", "Description") VALUES
('default', 1, 'Free tier - one public page per subscriber'),
('premium', 3, 'Premium tier - three public pages per subscriber'),
('enterprise', 10, 'Enterprise tier - ten public pages per subscriber');

-- Subscriber Handles
CREATE TABLE IF NOT EXISTS "SubscriberHandles" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "Handle" TEXT UNIQUE NOT NULL, -- e.g., 'john-poetry', 'john-novels'
    "DisplayName" TEXT NOT NULL,   -- e.g., 'John Smith - Poetry', 'John Smith - Novels'
    "Description" TEXT,            -- Brief description of this page's focus
    "IsActive" BOOLEAN DEFAULT TRUE,
    "IsPublic" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email")
);

-- Create unique index on handle
CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriber_handles_handle" ON "SubscriberHandles"("Handle");

-- Handle Suggestions
CREATE TABLE IF NOT EXISTS "HandleSuggestions" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "SuggestedHandle" TEXT NOT NULL,
    "BaseName" TEXT NOT NULL,      -- Original name used for suggestion
    "SuggestionType" TEXT NOT NULL, -- 'auto', 'user_request', 'system_generated'
    "IsUsed" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email")
);

-- Create index on subscriber email for suggestions
CREATE INDEX IF NOT EXISTS "idx_handle_suggestions_email" ON "HandleSuggestions"("SubscriberEmail");

-- Page Sections Configuration
CREATE TABLE IF NOT EXISTS "PageSections" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SectionKey" TEXT UNIQUE NOT NULL, -- 'announcements', 'blog', 'showcase', 'published_media', 'contact', 'bio', 'photo'
    "SectionName" TEXT NOT NULL,       -- 'Announcements', 'Blog', 'Showcase', 'Published Media', 'Contact', 'Bio', 'Photo'
    "Description" TEXT,                -- Brief description of the section
    "RequiredRoles" TEXT,              -- JSON array of roles that can use this section
    "IsActive" BOOLEAN DEFAULT TRUE,
    "SortOrder" INTEGER DEFAULT 0,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default page sections
INSERT OR IGNORE INTO "PageSections" ("SectionKey", "SectionName", "Description", "RequiredRoles", "SortOrder") VALUES
('bio', 'Bio', 'Personal biography and professional information', '["author", "editor", "agent", "reviewer", "publisher"]', 1),
('photo', 'Photo', 'Professional headshot or profile image', '["author", "editor", "agent", "reviewer", "publisher"]', 2),
('announcements', 'Announcements', 'Latest announcements and updates', '["author", "editor", "publisher"]', 3),
('blog', 'Blog', 'Blog posts and articles', '["author", "editor"]', 4),
('showcase', 'Showcase', 'Featured media file or project', '["author", "editor", "publisher"]', 5),
('published_media', 'Published Media', 'Complete listing of published content', '["author", "editor", "publisher"]', 6),
('contact', 'Contact', 'Contact form and messaging', '["author", "editor", "agent", "reviewer", "publisher"]', 7);

-- Handle Page Configuration
CREATE TABLE IF NOT EXISTS "HandlePageConfig" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "SectionKey" TEXT NOT NULL,
    "IsEnabled" BOOLEAN DEFAULT TRUE,
    "SortOrder" INTEGER DEFAULT 0,
    "CustomTitle" TEXT,               -- Optional custom title for the section
    "CustomDescription" TEXT,         -- Optional custom description
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id"),
    FOREIGN KEY ("SectionKey") REFERENCES "PageSections"("SectionKey"),
    UNIQUE("HandleId", "SectionKey")
);

-- Subscriber Blog Posts
CREATE TABLE IF NOT EXISTS "SubscriberBlogPosts" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,  -- Link to specific handle, not email
    "Title" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "Excerpt" TEXT,
    "Status" TEXT DEFAULT 'draft', -- draft, published, archived
    "PublishedAt" DATETIME,
    "Language" TEXT DEFAULT 'en',  -- Supports en, es, fr, de, nl
    "Tags" TEXT,
    "ViewCount" INTEGER DEFAULT 0,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);

-- Blog Comments
CREATE TABLE IF NOT EXISTS "BlogComments" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "BlogPostId" INTEGER NOT NULL,
    "AuthorEmail" TEXT NOT NULL,
    "AuthorName" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "ParentCommentId" INTEGER,        -- For reply functionality
    "Status" TEXT DEFAULT 'approved', -- approved, archived, flagged
    "IsModerated" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("BlogPostId") REFERENCES "SubscriberBlogPosts"("Id"),
    FOREIGN KEY ("AuthorEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("ParentCommentId") REFERENCES "BlogComments"("Id")
);

-- Content Ratings
CREATE TABLE IF NOT EXISTS "ContentRatings" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,      -- 'blog_post', 'published_content'
    "ContentId" INTEGER NOT NULL,     -- ID of the rated content
    "RaterEmail" TEXT,               -- NULL for anonymous ratings
    "RaterName" TEXT NOT NULL,       -- Display name for rating
    "Rating" INTEGER NOT NULL,       -- 1-5 star rating
    "Review" TEXT,                   -- Optional written review
    "Language" TEXT DEFAULT 'en',    -- Language of the review
    "IsVerified" BOOLEAN DEFAULT FALSE, -- Whether rater has verified account
    "Status" TEXT DEFAULT 'approved', -- approved, flagged, archived
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("RaterEmail") REFERENCES "Subscribers"("Email"),
    UNIQUE("ContentType", "ContentId", "RaterEmail") -- One rating per user per content
);

-- Rating Analytics
CREATE TABLE IF NOT EXISTS "RatingAnalytics" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,
    "ContentId" INTEGER NOT NULL,
    "AverageRating" DECIMAL(3,2) DEFAULT 0.00,
    "TotalRatings" INTEGER DEFAULT 0,
    "RatingDistribution" TEXT,       -- JSON: {"1": 5, "2": 10, "3": 25, "4": 30, "5": 30}
    "LastCalculated" DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("ContentType", "ContentId")
);

-- Subscriber Announcements
CREATE TABLE IF NOT EXISTS "SubscriberAnnouncements" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,  -- Link to specific handle, not email
    "Title" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "Link" TEXT,
    "LinkText" TEXT,
    "PublishedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" DATETIME,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "Language" TEXT DEFAULT 'en',  -- Supports en, es, fr, de, nl
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);

-- Subscriber Page Analytics
CREATE TABLE IF NOT EXISTS "SubscriberPageViews" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,  -- Link to specific handle for analytics
    "ViewerEmail" TEXT, -- NULL for anonymous
    "ViewerIp" TEXT,
    "ViewerUserAgent" TEXT,
    "PageType" TEXT NOT NULL, -- 'internal', 'external'
    "ViewedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "Referrer" TEXT,
    "Language" TEXT,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);

-- Admin Moderation and Monitoring
CREATE TABLE IF NOT EXISTS "SubscriberModeration" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "IsBanned" BOOLEAN DEFAULT FALSE,
    "CanPost" BOOLEAN DEFAULT TRUE,
    "IsModerated" BOOLEAN DEFAULT FALSE,
    "IsTracked" BOOLEAN DEFAULT TRUE,
    "BanReason" TEXT,
    "ModeratedBy" TEXT,
    "ModeratedAt" DATETIME,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("ModeratedBy") REFERENCES "Credentials"("Email")
);

-- Content Moderation
CREATE TABLE IF NOT EXISTS "ContentModeration" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,      -- 'blog_post', 'announcement', 'comment'
    "ContentId" INTEGER NOT NULL,     -- ID of the moderated content
    "SubscriberEmail" TEXT NOT NULL,
    "Action" TEXT NOT NULL,           -- 'removed', 'hidden', 'flagged', 'approved'
    "Reason" TEXT,
    "ModeratedBy" TEXT,
    "ModeratedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("ModeratedBy") REFERENCES "Credentials"("Email")
);

-- Handle Moderation
CREATE TABLE IF NOT EXISTS "HandleModeration" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "Action" TEXT NOT NULL,           -- 'suspended', 'hidden', 'flagged', 'approved'
    "Reason" TEXT,
    "ModeratedBy" TEXT,
    "ModeratedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id"),
    FOREIGN KEY ("ModeratedBy") REFERENCES "Credentials"("Email")
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for SubscriberHandles
CREATE INDEX IF NOT EXISTS "idx_subscriber_handles_email" ON "SubscriberHandles"("SubscriberEmail");
CREATE INDEX IF NOT EXISTS "idx_subscriber_handles_active" ON "SubscriberHandles"("IsActive");
CREATE INDEX IF NOT EXISTS "idx_subscriber_handles_public" ON "SubscriberHandles"("IsPublic");

-- Indexes for SubscriberBlogPosts
CREATE INDEX IF NOT EXISTS "idx_blog_posts_handle" ON "SubscriberBlogPosts"("HandleId");
CREATE INDEX IF NOT EXISTS "idx_blog_posts_status" ON "SubscriberBlogPosts"("Status");
CREATE INDEX IF NOT EXISTS "idx_blog_posts_language" ON "SubscriberBlogPosts"("Language");
CREATE INDEX IF NOT EXISTS "idx_blog_posts_published" ON "SubscriberBlogPosts"("PublishedAt");

-- Indexes for BlogComments
CREATE INDEX IF NOT EXISTS "idx_comments_blog_post" ON "BlogComments"("BlogPostId");
CREATE INDEX IF NOT EXISTS "idx_comments_author" ON "BlogComments"("AuthorEmail");
CREATE INDEX IF NOT EXISTS "idx_comments_status" ON "BlogComments"("Status");
CREATE INDEX IF NOT EXISTS "idx_comments_parent" ON "BlogComments"("ParentCommentId");

-- Indexes for ContentRatings
CREATE INDEX IF NOT EXISTS "idx_ratings_content" ON "ContentRatings"("ContentType", "ContentId");
CREATE INDEX IF NOT EXISTS "idx_ratings_rater" ON "ContentRatings"("RaterEmail");
CREATE INDEX IF NOT EXISTS "idx_ratings_status" ON "ContentRatings"("Status");

-- Indexes for SubscriberAnnouncements
CREATE INDEX IF NOT EXISTS "idx_announcements_handle" ON "SubscriberAnnouncements"("HandleId");
CREATE INDEX IF NOT EXISTS "idx_announcements_active" ON "SubscriberAnnouncements"("IsActive");
CREATE INDEX IF NOT EXISTS "idx_announcements_published" ON "SubscriberAnnouncements"("PublishedAt");

-- Indexes for SubscriberPageViews
CREATE INDEX IF NOT EXISTS "idx_page_views_handle" ON "SubscriberPageViews"("HandleId");
CREATE INDEX IF NOT EXISTS "idx_page_views_viewed_at" ON "SubscriberPageViews"("ViewedAt");
CREATE INDEX IF NOT EXISTS "idx_page_views_viewer" ON "SubscriberPageViews"("ViewerEmail");

-- Indexes for moderation tables
CREATE INDEX IF NOT EXISTS "idx_subscriber_moderation_email" ON "SubscriberModeration"("SubscriberEmail");
CREATE INDEX IF NOT EXISTS "idx_content_moderation_content" ON "ContentModeration"("ContentType", "ContentId");
CREATE INDEX IF NOT EXISTS "idx_handle_moderation_handle" ON "HandleModeration"("HandleId");

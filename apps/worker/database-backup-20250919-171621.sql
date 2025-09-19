PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "BlogComments" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "BlogPostId" INTEGER NOT NULL,
    "AuthorEmail" TEXT NOT NULL,
    "AuthorName" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "ParentCommentId" INTEGER,
    "Status" TEXT DEFAULT 'approved',
    "IsModerated" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("BlogPostId") REFERENCES "SubscriberBlogPosts"("Id"),
    FOREIGN KEY ("AuthorEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("ParentCommentId") REFERENCES "BlogComments"("Id")
);
CREATE TABLE IF NOT EXISTS "ContactSubmissions" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, HandleId INTEGER, HandleEmail TEXT);
CREATE TABLE ContentLinks (Id INTEGER PRIMARY KEY AUTOINCREMENT, ContentType TEXT NOT NULL, ContentId INTEGER NOT NULL, LinkedContentType TEXT NOT NULL, LinkedContentId INTEGER NOT NULL, CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(ContentType, ContentId, LinkedContentType, LinkedContentId));
CREATE TABLE IF NOT EXISTS "ContentModeration" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,
    "ContentId" INTEGER NOT NULL,
    "SubscriberEmail" TEXT NOT NULL,
    "Action" TEXT NOT NULL,
    "Reason" TEXT,
    "ModeratedBy" TEXT,
    "ModeratedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("ModeratedBy") REFERENCES "Credentials"("Email")
);
CREATE TABLE IF NOT EXISTS "ContentRatings" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,
    "ContentId" INTEGER NOT NULL,
    "RaterEmail" TEXT,
    "RaterName" TEXT NOT NULL,
    "Rating" INTEGER NOT NULL,
    "Review" TEXT,
    "Language" TEXT DEFAULT 'en',
    "IsVerified" BOOLEAN DEFAULT FALSE,
    "Status" TEXT DEFAULT 'approved',
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("RaterEmail") REFERENCES "Subscribers"("Email"),
    UNIQUE("ContentType", "ContentId", "RaterEmail")
);
CREATE TABLE ContentUsage (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ContentId TEXT NOT NULL,
    UserEmail TEXT,
    UsageType TEXT NOT NULL CHECK (UsageType IN ('view', 'download', 'favorite', 'comment', 'rating', 'share')),
    UsageData JSON,
    IpAddress TEXT,
    UserAgent TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ContentId) REFERENCES PublishedContent(Id)
);
CREATE TABLE IF NOT EXISTS "Credentials" ( "Email" VARCHAR(8000) PRIMARY KEY, "Password" VARCHAR(8000) NULL, "Role" VARCHAR(8000) NULL, CreatedAt TEXT, UpdatedAt TEXT);
INSERT INTO "Credentials" VALUES('admin@dreamtone.com','$2b$10$YQ0SYb4zHHYOJ6DjOHT4X.5nGmKTepW6TDuKTQMmASOAxdDz3Md.a','admin','2025-05-30 13:43:11','2025-05-30 18:18:13');
CREATE TABLE Form ( Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Description TEXT, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP );
INSERT INTO "Form" VALUES('poetry','Poetry','Poetic works including sonnets, free verse, and other poetic forms',NULL,NULL);
INSERT INTO "Form" VALUES('novel','Novel','Long-form fictional narrative works',NULL,NULL);
INSERT INTO "Form" VALUES('short-story','Short Story','Brief fictional narratives',NULL,NULL);
INSERT INTO "Form" VALUES('essay','Essay','Non-fiction analytical or descriptive compositions',NULL,NULL);
INSERT INTO "Form" VALUES('article','Article','Informational or journalistic pieces',NULL,NULL);
INSERT INTO "Form" VALUES('review','Review','Critical evaluations of works or products',NULL,NULL);
INSERT INTO "Form" VALUES('blog-post','Blog Post','Informal online articles and posts',NULL,NULL);
CREATE TABLE Genre ( Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Description TEXT, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP );
INSERT INTO "Genre" VALUES('literary','Literary Fiction','Character-driven stories with artistic merit',NULL,NULL);
INSERT INTO "Genre" VALUES('science-fiction','Science Fiction','Speculative fiction with scientific elements',NULL,NULL);
INSERT INTO "Genre" VALUES('fantasy','Fantasy','Imaginative fiction with magical or supernatural elements',NULL,NULL);
INSERT INTO "Genre" VALUES('romance','Romance','Stories focused on romantic relationships',NULL,NULL);
INSERT INTO "Genre" VALUES('mystery','Mystery','Stories involving puzzles, crimes, or investigations',NULL,NULL);
INSERT INTO "Genre" VALUES('thriller','Thriller','Suspenseful and exciting narratives',NULL,NULL);
INSERT INTO "Genre" VALUES('young-adult','Young Adult','Literature targeted at adolescent readers',NULL,NULL);
INSERT INTO "Genre" VALUES('historical','Historical Fiction','Fictional stories set in historical periods',NULL,NULL);
INSERT INTO "Genre" VALUES('contemporary','Contemporary','Modern realistic fiction',NULL,NULL);
INSERT INTO "Genre" VALUES('non-fiction','Non-Fiction','Factual and informational content',NULL,NULL);
CREATE TABLE IF NOT EXISTS "HandleModeration" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "Action" TEXT NOT NULL,
    "Reason" TEXT,
    "ModeratedBy" TEXT,
    "ModeratedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id"),
    FOREIGN KEY ("ModeratedBy") REFERENCES "Credentials"("Email")
);
CREATE TABLE IF NOT EXISTS "HandlePageConfig" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "SectionKey" TEXT NOT NULL,
    "IsEnabled" BOOLEAN DEFAULT TRUE,
    "SortOrder" INTEGER DEFAULT 0,
    "CustomTitle" TEXT,
    "CustomDescription" TEXT,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id"),
    FOREIGN KEY ("SectionKey") REFERENCES "PageSections"("SectionKey"),
    UNIQUE("HandleId", "SectionKey")
);
CREATE TABLE IF NOT EXISTS "HandleSuggestions" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "SuggestedHandle" TEXT NOT NULL,
    "BaseName" TEXT NOT NULL,
    "SuggestionType" TEXT NOT NULL,
    "IsUsed" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email")
);
CREATE TABLE IF NOT EXISTS "IndividualSubscriberHandleLimits" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "LimitType" TEXT NOT NULL,
    "Description" TEXT,
    "SetBy" TEXT NOT NULL,
    "SetAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" DATETIME,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email"),
    FOREIGN KEY ("SetBy") REFERENCES "Credentials"("Email")
);
CREATE TABLE IF NOT EXISTS "MediaAccess" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MediaId INTEGER NOT NULL,
    TenantId TEXT NOT NULL,
    RoleId TEXT NOT NULL,
    AccessType TEXT NOT NULL CHECK (AccessType IN ('view', 'download', 'edit', 'delete', 'upload')),
    GrantedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    GrantedBy TEXT NOT NULL,
    ExpiresAt DATETIME,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id) ON DELETE CASCADE,
    FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);
CREATE TABLE MediaAccessTemplates (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    RoleId TEXT NOT NULL,
    AccessType TEXT NOT NULL CHECK (AccessType IN ('view', 'download', 'edit', 'delete')),
    FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);
CREATE TABLE MediaFiles (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    FileName TEXT NOT NULL,
    FileSize INTEGER NOT NULL,
    ContentType TEXT NOT NULL,
    MediaType TEXT NOT NULL CHECK (MediaType IN ('audio', 'video', 'image', 'document')),
    R2Key TEXT NOT NULL,
    UploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UploadedBy TEXT NOT NULL,
    Description TEXT,
    Metadata JSON,
    Duration INTEGER,
    Width INTEGER,
    Height INTEGER
, IsDeleted BOOLEAN DEFAULT 0, DeletedAt DATETIME, DeletedBy TEXT, Language TEXT DEFAULT 'en');
CREATE TABLE IF NOT EXISTS "MediaShareLinks" (Id INTEGER PRIMARY KEY AUTOINCREMENT, MediaId INTEGER NOT NULL, ShareToken TEXT NOT NULL, CreatedBy TEXT NOT NULL, TenantId TEXT, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, ExpiresAt DATETIME, MaxAccesses INTEGER, AccessCount INTEGER DEFAULT 0, PasswordHash TEXT, FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS "MessageAttachments" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    MediaId INTEGER,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    AttachmentType TEXT DEFAULT 'media_library',
    FileName TEXT,
    FileSize INTEGER,
    ContentType TEXT,
    R2Key TEXT,
    UploadDate TEXT,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id)
);
CREATE TABLE IF NOT EXISTS "MessageLinks" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    Url TEXT NOT NULL,
    Title TEXT,
    Description TEXT,
    ImageUrl TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsDeleted BOOLEAN DEFAULT FALSE, ThumbnailUrl TEXT, Domain TEXT,
    FOREIGN KEY (MessageId) REFERENCES "Messages"(Id) ON DELETE CASCADE
);
CREATE TABLE MessageRateLimits (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  SenderEmail TEXT NOT NULL,
  LastMessageAt DATETIME NOT NULL,
  MessageCount INTEGER DEFAULT 1,
  ResetAt DATETIME NOT NULL,
  FOREIGN KEY (SenderEmail) REFERENCES Subscribers(Email)
);
CREATE TABLE IF NOT EXISTS "MessageRecipients" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    RecipientEmail TEXT NOT NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    ReadAt DATETIME,
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    IsForwarded BOOLEAN DEFAULT FALSE,
    ForwardedAt DATETIME,
    IsSaved BOOLEAN DEFAULT FALSE,
    SavedAt DATETIME,
    IsReplied BOOLEAN DEFAULT FALSE,
    RepliedAt DATETIME,
    IsArchived BOOLEAN DEFAULT FALSE,
    ArchivedAt TEXT,
    RecipientType TEXT DEFAULT 'subscriber',
    FOREIGN KEY (MessageId) REFERENCES "Messages"(Id) ON DELETE CASCADE
);
CREATE TABLE MessageThreads (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ParentMessageId INTEGER NULL,
  ChildMessageId INTEGER NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ParentMessageId) REFERENCES Messages(Id),
  FOREIGN KEY (ChildMessageId) REFERENCES Messages(Id)
);
CREATE TABLE IF NOT EXISTS "Messages" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Subject TEXT NOT NULL,
    Body TEXT NOT NULL,
    SenderEmail TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    MessageType TEXT NOT NULL DEFAULT 'direct',
    Priority TEXT DEFAULT 'normal',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    IsDeleted BOOLEAN DEFAULT FALSE,
    IsRecalled BOOLEAN DEFAULT FALSE,
    RecalledAt DATETIME,
    RecallReason TEXT,
    IsArchived BOOLEAN DEFAULT FALSE,
    ArchivedAt TEXT,
    DeletedAt DATETIME,
    HasAttachments BOOLEAN DEFAULT FALSE,
    AttachmentCount INTEGER DEFAULT 0,
    SenderType TEXT DEFAULT 'subscriber',
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
CREATE TABLE IF NOT EXISTS "PageSections" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SectionKey" TEXT UNIQUE NOT NULL,
    "SectionName" TEXT NOT NULL,
    "Description" TEXT,
    "RequiredRoles" TEXT,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "SortOrder" INTEGER DEFAULT 0,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Permissions (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    Resource TEXT NOT NULL,
    Action TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Permissions" VALUES('read:blog','Read Blog Posts','Can view blog posts','blog','read','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('write:blog','Write Blog Posts','Can create and edit blog posts','blog','write','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('delete:blog','Delete Blog Posts','Can delete blog posts','blog','delete','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('read:media','Read Media','Can view media files','media','read','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('write:media','Write Media','Can upload media files','media','write','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('delete:media','Delete Media','Can delete media files','media','delete','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('manage:subscribers','Manage Subscribers','Can manage subscriber accounts','subscribers','manage','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Permissions" VALUES('read:subscribers','Read Subscribers','Can view subscriber information','subscribers','read','2025-05-11 16:32:33','2025-05-11 16:32:33');
INSERT INTO "Permissions" VALUES('write:subscribers','Write Subscribers','Can manage subscriber information','subscribers','write','2025-05-11 16:32:33','2025-05-11 16:32:33');
INSERT INTO "Permissions" VALUES('read:routes','Read Routes','Can view route information','routes','read','2025-05-11 16:32:33','2025-05-11 16:32:33');
INSERT INTO "Permissions" VALUES(NULL,'media.read','Read access to media files','media','read','2025-05-12 20:45:54','2025-05-12 20:45:54');
INSERT INTO "Permissions" VALUES(NULL,'media.write','Write access to media files','media','write','2025-05-12 20:45:54','2025-05-12 20:45:54');
INSERT INTO "Permissions" VALUES(NULL,'media.delete','Delete access to media files','media','delete','2025-05-12 20:45:54','2025-05-12 20:45:54');
INSERT INTO "Permissions" VALUES(NULL,'media.download','Download access to media files','media','download','2025-05-12 20:45:54','2025-05-12 20:45:54');
INSERT INTO "Permissions" VALUES('workflow.initiate','Initiate Workflow','Can start workflow processes','workflow','initiate','2025-07-16 18:33:42','2025-07-16 18:33:42');
INSERT INTO "Permissions" VALUES('workflow.respond','Respond to Workflow','Can respond to workflow requests','workflow','respond','2025-07-16 18:33:42','2025-07-16 18:33:42');
INSERT INTO "Permissions" VALUES('workflow.view','View Workflow','Can view workflow history','workflow','view','2025-07-16 18:33:42','2025-07-16 18:33:42');
INSERT INTO "Permissions" VALUES('workflow.manage','Manage Workflow','Can manage workflow settings','workflow','manage','2025-07-16 18:33:42','2025-07-16 18:33:42');
INSERT INTO "Permissions" VALUES('workflow.complete','Complete Workflow','Can complete workflow processes','workflow','complete','2025-07-16 18:33:42','2025-07-16 18:33:42');
INSERT INTO "Permissions" VALUES('content.publish','Publish Content','Can publish content to subscribers','content','publish','2025-08-27 20:50:05','2025-08-27 20:50:05');
INSERT INTO "Permissions" VALUES('content.unpublish','Unpublish Content','Can remove content from public access','content','unpublish','2025-08-27 20:50:05','2025-08-27 20:50:05');
INSERT INTO "Permissions" VALUES('content.manage_protection','Manage Protection','Can set content protection settings','content','manage_protection','2025-08-27 20:50:05','2025-08-27 20:50:05');
CREATE TABLE Preferences (
  Email TEXT PRIMARY KEY,
  Theme TEXT DEFAULT 'light' CHECK (Theme IN ('light', 'dark')),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
, Language TEXT DEFAULT 'en' CHECK (Language IN ('en', 'de', 'es', 'fr', 'nl')), CurrentProvider TEXT);
CREATE TABLE IF NOT EXISTS "PublishedContent" (
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


);
CREATE TABLE PublishedContentTokens (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PublishedContentId TEXT NOT NULL,
    AccessToken TEXT NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    IsActive BOOLEAN DEFAULT 1,
    FOREIGN KEY (PublishedContentId) REFERENCES PublishedContent(Id)
);
CREATE TABLE IF NOT EXISTS "RatingAnalytics" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ContentType" TEXT NOT NULL,
    "ContentId" INTEGER NOT NULL,
    "AverageRating" DECIMAL(3,2) DEFAULT 0.00,
    "TotalRatings" INTEGER DEFAULT 0,
    "RatingDistribution" TEXT,
    "LastCalculated" DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("ContentType", "ContentId")
);
CREATE TABLE ResourceAccess (Id INTEGER PRIMARY KEY AUTOINCREMENT, ResourceId INTEGER NOT NULL, RoleId TEXT NOT NULL, AccessLevel TEXT NOT NULL CHECK (AccessLevel IN ('full', 'write', 'read', 'none')), CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (ResourceId) REFERENCES Resources(Id), FOREIGN KEY (RoleId) REFERENCES Roles(Id));
CREATE TABLE Resources (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Type TEXT NOT NULL CHECK (Type IN ('page', 'api', 'content', 'media')),
  Name TEXT NOT NULL,
  Description TEXT
);
CREATE TABLE RolePermissions (RoleId TEXT NOT NULL, PermissionId TEXT NOT NULL, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (RoleId, PermissionId), FOREIGN KEY (RoleId) REFERENCES Roles(Id), FOREIGN KEY (PermissionId) REFERENCES Permissions(Id));
INSERT INTO "RolePermissions" VALUES('admin','workflow.initiate','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('admin','workflow.respond','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('admin','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('admin','workflow.manage','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('admin','workflow.complete','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('author','workflow.initiate','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('author','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('author','workflow.complete','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('editor','workflow.respond','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('editor','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('agent','workflow.respond','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('agent','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('reviewer','workflow.respond','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('reviewer','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('subscriber','workflow.view','2025-07-16 18:33:42');
INSERT INTO "RolePermissions" VALUES('publisher','content.publish','2025-08-27 20:50:50');
INSERT INTO "RolePermissions" VALUES('publisher','content.unpublish','2025-08-27 20:50:50');
INSERT INTO "RolePermissions" VALUES('publisher','content.manage_protection','2025-08-27 20:50:50');
CREATE TABLE Roles (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Roles" VALUES('admin','Administrator','Full system access','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Roles" VALUES('editor','Editor','Can create and edit content','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Roles" VALUES('author','Author','Can create content','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Roles" VALUES('subscriber','Subscriber','Basic access','2025-05-11 16:21:18','2025-05-11 16:21:18');
INSERT INTO "Roles" VALUES('agent','Agent','Can read and share content','2025-05-11 16:32:33','2025-05-11 16:32:33');
INSERT INTO "Roles" VALUES('reviewer','Reviewer','Can read and comment on content','2025-05-11 16:32:33','2025-05-11 16:32:33');
INSERT INTO "Roles" VALUES('user','User','Basic non-subscriber access','2025-05-15 12:20:42','2025-05-15 12:20:42');
INSERT INTO "Roles" VALUES('tenant','Tenant','Full tenant access','2025-05-18 12:53:33','2025-05-18 12:53:47');
INSERT INTO "Roles" VALUES('publisher','Publisher','Can publish content to subscribers','2025-08-01 21:22:19','2025-08-01 21:22:19');
CREATE TABLE IF NOT EXISTS "SubscriberAnnouncements" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "Link" TEXT,
    "LinkText" TEXT,
    "PublishedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" DATETIME,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "Language" TEXT DEFAULT 'en', IsPublic BOOLEAN DEFAULT TRUE, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);
CREATE TABLE SubscriberBiographies (Id INTEGER PRIMARY KEY AUTOINCREMENT, HandleId INTEGER NOT NULL, Bio TEXT NOT NULL, IsActive INTEGER DEFAULT 1, IsPublic INTEGER DEFAULT 1, Language TEXT DEFAULT 'en', CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP, UpdatedAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (HandleId) REFERENCES SubscriberHandles(Id));
CREATE TABLE IF NOT EXISTS "SubscriberBlogPosts" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "Excerpt" TEXT,
    "Status" TEXT DEFAULT 'draft',
    "PublishedAt" DATETIME,
    "Language" TEXT DEFAULT 'en',
    "Tags" TEXT,
    "ViewCount" INTEGER DEFAULT 0,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);
CREATE TABLE SubscriberContactInfo (Id INTEGER PRIMARY KEY AUTOINCREMENT, HandleId INTEGER NOT NULL, Email TEXT, Phone TEXT, Website TEXT, Location TEXT, SocialLinks TEXT, IsActive INTEGER DEFAULT 1, IsPublic INTEGER DEFAULT 1, Language TEXT DEFAULT 'en', CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP, UpdatedAt TEXT DEFAULT CURRENT_TIMESTAMP, ContactFormEnabled BOOLEAN DEFAULT FALSE, FOREIGN KEY (HandleId) REFERENCES SubscriberHandles(Id));
CREATE TABLE IF NOT EXISTS "SubscriberHandleLimits" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "LimitType" TEXT UNIQUE NOT NULL,
    "MaxHandles" INTEGER NOT NULL DEFAULT 1,
    "Description" TEXT,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SubscriberHandles" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SubscriberEmail" TEXT NOT NULL,
    "Handle" TEXT UNIQUE NOT NULL,
    "DisplayName" TEXT NOT NULL,
    "Description" TEXT,
    "IsActive" BOOLEAN DEFAULT TRUE,
    "IsPublic" BOOLEAN DEFAULT FALSE,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP, ContactFormEnabled BOOLEAN DEFAULT FALSE, ContactEmail TEXT,
    FOREIGN KEY ("SubscriberEmail") REFERENCES "Subscribers"("Email")
);
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
CREATE TABLE IF NOT EXISTS "SubscriberPageViews" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "HandleId" INTEGER NOT NULL,
    "ViewerEmail" TEXT,
    "ViewerIp" TEXT,
    "ViewerUserAgent" TEXT,
    "PageType" TEXT NOT NULL,
    "ViewedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "Referrer" TEXT,
    "Language" TEXT,
    FOREIGN KEY ("HandleId") REFERENCES "SubscriberHandles"("Id")
);
CREATE TABLE Subscribers (
    Email TEXT PRIMARY KEY,
    EmailVerified DATETIME,
    Name TEXT,
    Joined DATETIME,
    Signin DATETIME,
    Left DATETIME,
    Active BOOLEAN DEFAULT false,
    Banned BOOLEAN DEFAULT false,
    Post BOOLEAN DEFAULT false,
    Moderate BOOLEAN DEFAULT false,
    Track BOOLEAN DEFAULT false,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
, 'Provider'  TEXT DEFAULT 'credentials', EmailPreferences TEXT DEFAULT '{"newsletters": true, "announcements": true, "role_updates": true, "tenant_updates": true, "workflow_updates": true, "handle_updates": true, "blog_updates": true, "content_updates": true, "welcome": true}', VerificationToken TEXT, VerificationExpires DATETIME);
CREATE TABLE SystemLogs (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    LogType TEXT NOT NULL,
    Timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,


    UserId TEXT,
    UserEmail TEXT,
    Provider TEXT,
    TenantId TEXT,


    ActivityType TEXT,
    AccessType TEXT,
    TargetId TEXT,
    TargetName TEXT,


    IpAddress TEXT,
    UserAgent TEXT,


    Metadata TEXT,
    IsDeleted BOOLEAN DEFAULT 0
);
INSERT INTO "SystemLogs" VALUES(1,'authentication','2025-09-19T21:14:19.436Z','a73a2dff-7fe5-40ec-8c3f-b1fee1de7d69','admin@dreamtone.com','credentials',NULL,'signin','auth','admin@dreamtone.com','admin@dreamtone.com (credentials)','2605:59c0:3e0:9d10:a02a:fbc5:83c6:72d4','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','{"sessionStartTime":"2025-09-19T21:14:19.436Z","provider":"credentials","operationType":"user_signin","timestamp":"2025-09-19T21:14:19.436Z"}',0);
CREATE TABLE SystemSettings (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy TEXT NOT NULL
);
INSERT INTO "SystemSettings" VALUES('messaging_enabled','true','2025-07-15 18:47:35','system');
INSERT INTO "SystemSettings" VALUES('messaging_rate_limit','60','2025-07-15 18:47:35','system');
INSERT INTO "SystemSettings" VALUES('messaging_max_recipients','100','2025-07-15 18:47:35','system');
INSERT INTO "SystemSettings" VALUES('messaging_recall_window','3600','2025-07-15 18:47:35','system');
INSERT INTO "SystemSettings" VALUES('messaging_message_expiry','2592000','2025-07-15 18:47:35','system');
INSERT INTO "SystemSettings" VALUES('workflow_enabled','true','2025-07-16 18:31:36','system');
INSERT INTO "SystemSettings" VALUES('workflow_rate_limit','60','2025-07-16 18:31:36','system');
INSERT INTO "SystemSettings" VALUES('workflow_max_participants','10','2025-07-16 18:31:36','system');
INSERT INTO "SystemSettings" VALUES('workflow_auto_complete_days','30','2025-07-16 18:31:36','system');
INSERT INTO "SystemSettings" VALUES('workflow_retention_days','365','2025-07-16 18:31:36','system');
INSERT INTO "SystemSettings" VALUES('log_retention_days','90','2025-08-20 17:56:01','admin@dreamtone.com');
INSERT INTO "SystemSettings" VALUES('log_archive_enabled','true','2025-08-20 17:56:01','admin@dreamtone.com');
INSERT INTO "SystemSettings" VALUES('log_hard_delete_delay','7','2025-08-20 17:56:01','admin@dreamtone.com');
INSERT INTO "SystemSettings" VALUES('log_archive_cron_schedule','0 2 * * *','2025-08-20 17:56:01','admin@dreamtone.com');
CREATE TABLE TenantResources (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  TenantId TEXT NOT NULL,
  ResourceId INTEGER NOT NULL,
  AccessLevel TEXT NOT NULL CHECK (AccessLevel IN ('full', 'write', 'read', 'none')),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
  FOREIGN KEY (ResourceId) REFERENCES Resources(Id)
);
CREATE TABLE IF NOT EXISTS "TenantSubmissions" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, organization TEXT NOT NULL, purpose TEXT NOT NULL, message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "TenantUsers" (TenantId TEXT NOT NULL, Email TEXT NOT NULL, RoleId TEXT NOT NULL, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (TenantId, Email));
CREATE TABLE TenantUsers_backup(
  TenantId TEXT,
  UserId TEXT,
  RoleId TEXT,
  CreatedAt NUM,
  UpdatedAt NUM
);
CREATE TABLE Tenants (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Tenants" VALUES('default','Default Tenant','Default tenant for new users','2025-08-04 21:30:56','2025-08-04 21:30:56');
INSERT INTO "Tenants" VALUES('test-tenant-1','Test Tenant 1','Test Tenant 1','2025-08-05 20:13:10','2025-08-05 20:13:10');
INSERT INTO "Tenants" VALUES('test-tenant-2','Test Tenant 2','Test Tenant 2','2025-08-05 20:13:10','2025-08-05 20:13:10');
INSERT INTO "Tenants" VALUES('test-tenant-3','Test Tenant 3','Test Tenant 3','2025-08-05 20:13:10','2025-08-05 20:13:10');
INSERT INTO "Tenants" VALUES('test-tenant-4','Test Tenant 4','Test Tenant 4','2025-08-05 20:13:10','2025-08-05 20:13:10');
INSERT INTO "Tenants" VALUES('test-tenant-5','Test Tenant 5','Test Tenant 5','2025-08-05 20:13:10','2025-08-05 20:13:10');
INSERT INTO "Tenants" VALUES('test-tenant-6','Test Tenant 6','Test Tenant 6','2025-08-05 20:13:10','2025-08-05 20:13:10');
CREATE TABLE IF NOT EXISTS "TestSessions" (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  SessionToken TEXT UNIQUE NOT NULL,
  TestUserEmail TEXT NOT NULL,
  CreatedBy TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  LastAccessed TEXT,
  IpAddress TEXT,
  UserAgent TEXT
);
CREATE TABLE UserActivity (
    Id TEXT PRIMARY KEY,
    UserId TEXT NOT NULL,
    Email TEXT NOT NULL,
    Provider TEXT NOT NULL,
    ActivityType TEXT NOT NULL CHECK (ActivityType IN ('signin', 'signout')),
    ActivityTime TEXT NOT NULL,
    IpAddress TEXT,
    UserAgent TEXT,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL
);
CREATE TABLE UserAvatars (Id INTEGER PRIMARY KEY AUTOINCREMENT, UserId TEXT NOT NULL, R2Key TEXT NOT NULL, IsPreset BOOLEAN DEFAULT false, UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UploadedBy TEXT NOT NULL, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, IsActive BOOLEAN DEFAULT 1, FOREIGN KEY (UserId) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS "UserBlocks" (Id INTEGER PRIMARY KEY, BlockerEmail TEXT NOT NULL, BlockedEmail TEXT NOT NULL, TenantId TEXT NOT NULL, Reason TEXT, CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, IsActive BOOLEAN DEFAULT TRUE);
CREATE TABLE UserRoles (
  TenantId TEXT NOT NULL,
  Email TEXT NOT NULL,
  RoleId TEXT NOT NULL,
  PRIMARY KEY (TenantId, Email, RoleId),
  FOREIGN KEY (TenantId, Email) REFERENCES TenantUsers(TenantId, Email) ON DELETE CASCADE,
  FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "WorkflowHistory" (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    InitiatorEmail TEXT NOT NULL,
    Title TEXT NOT NULL,
    Status TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    CompletedBy TEXT,
    DeletedAt TEXT,
    DeletedBy TEXT,
    EventType TEXT NOT NULL CHECK (EventType IN ('created', 'updated', 'completed', 'terminated', 'deleted', 'reactivated')),
    EventTimestamp TEXT NOT NULL,
    EventPerformedBy TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "WorkflowInvitations" (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    InviterEmail TEXT NOT NULL,
    InviteeEmail TEXT NOT NULL,
    Role TEXT NOT NULL,
    Status TEXT NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending', 'accepted', 'rejected', 'expired')),
    Message TEXT,
    ExpiresAt TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);
CREATE TABLE WorkflowMessageRecipients (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    WorkflowMessageId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    ReadAt DATETIME,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (WorkflowMessageId) REFERENCES WorkflowMessages(Id) ON DELETE CASCADE
);
CREATE TABLE WorkflowMessages (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    SenderEmail TEXT NOT NULL,
    MessageType TEXT NOT NULL CHECK (MessageType IN ('request', 'response', 'upload', 'share_link')),
    Content TEXT NOT NULL,
    MediaFileId INTEGER,
    ShareToken TEXT,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "WorkflowParticipants" (
    WorkflowId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    Role TEXT NOT NULL,
    JoinedAt TEXT NOT NULL,
    PRIMARY KEY (WorkflowId, ParticipantEmail),
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "Workflows" (
    Id TEXT PRIMARY KEY,
    TenantId TEXT NOT NULL,
    InitiatorEmail TEXT NOT NULL,
    Title TEXT,
    Status TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active', 'completed', 'terminated', 'deleted', 'reactivated')),
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    CompletedBy TEXT
);
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" text NOT NULL,
    "userId" text NOT NULL DEFAULT NULL,
    "type" text NOT NULL DEFAULT NULL,
    "provider" text NOT NULL DEFAULT NULL,
    "providerAccountId" text NOT NULL DEFAULT NULL,
    "refresh_token" text DEFAULT NULL,
    "access_token" text DEFAULT NULL,
    "expires_at" number DEFAULT NULL,
    "token_type" text DEFAULT NULL,
    "scope" text DEFAULT NULL,
    "id_token" text DEFAULT NULL,
    "session_state" text DEFAULT NULL,
    "oauth_token_secret" text DEFAULT NULL,
    "oauth_token" text DEFAULT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL DEFAULT NULL,
    "expires" datetime NOT NULL DEFAULT NULL,
    PRIMARY KEY (sessionToken)
);
INSERT INTO "sessions" VALUES('ae060470-b10c-4ea8-8cec-dd808b68bc96','35e797b1-ceb0-4b7f-89e7-6771dd6f9af5','a73a2dff-7fe5-40ec-8c3f-b1fee1de7d69','2025-10-19T21:14:19.422Z');
CREATE TABLE IF NOT EXISTS "users" (
    "id" text NOT NULL DEFAULT '',
    "name" text DEFAULT NULL,
    "email" text DEFAULT NULL,
    "emailVerified" datetime DEFAULT NULL,
    "image" text DEFAULT NULL,
    PRIMARY KEY (id)
);
INSERT INTO "users" VALUES('a73a2dff-7fe5-40ec-8c3f-b1fee1de7d69','Admin User','admin@dreamtone.com',NULL,NULL);
CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" text NOT NULL,
    "token" text NOT NULL DEFAULT NULL,
    "expires" datetime NOT NULL DEFAULT NULL,
    PRIMARY KEY (token)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('SystemLogs',1);
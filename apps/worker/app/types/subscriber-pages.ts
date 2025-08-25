// Subscriber Pages Type Definitions
// This file contains all TypeScript types for the subscriber pages feature

// =============================================================================
// DATABASE ENTITIES
// =============================================================================

export interface SubscriberProfile {
  Email: string;
  Bio?: string;
  PhotoUrl?: string;
  Website?: string;
  SocialLinks?: string; // JSON array of social media links
  Language: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface SubscriberHandleLimit {
  Id: number;
  LimitType: 'default' | 'premium' | 'enterprise';
  MaxHandles: number;
  Description?: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface SubscriberHandle {
  Id: number;
  SubscriberEmail: string;
  Handle: string;
  DisplayName: string;
  Description?: string;
  IsActive: boolean;
  IsPublic: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface HandleSuggestion {
  Id: number;
  SubscriberEmail: string;
  SuggestedHandle: string;
  BaseName: string;
  SuggestionType: 'auto' | 'user_request' | 'system_generated';
  IsUsed: boolean;
  CreatedAt: string;
}

export interface PageSection {
  Id: number;
  SectionKey: string;
  SectionName: string;
  Description?: string;
  RequiredRoles: string; // JSON array of roles
  IsActive: boolean;
  SortOrder: number;
  CreatedAt: string;
}

export interface HandlePageConfig {
  Id: number;
  HandleId: number;
  SectionKey: string;
  IsEnabled: boolean;
  SortOrder: number;
  CustomTitle?: string;
  CustomDescription?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface SubscriberBlogPost {
  Id: number;
  HandleId: number;
  Title: string;
  Content: string;
  Excerpt?: string;
  Status: 'draft' | 'published' | 'archived';
  PublishedAt?: string;
  Language: string;
  Tags?: string;
  ViewCount: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface BlogComment {
  Id: number;
  BlogPostId: number;
  AuthorEmail: string;
  AuthorName: string;
  Content: string;
  ParentCommentId?: number;
  Status: 'approved' | 'pending' | 'archived' | 'flagged';
  IsModerated: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ContentRating {
  Id: number;
  ContentType: 'blog_post' | 'published_content';
  ContentId: number;
  RaterEmail?: string;
  RaterName: string;
  Rating: number; // 1-5
  Review?: string;
  Language: string;
  IsVerified: boolean;
  Status: 'approved' | 'flagged' | 'archived';
  CreatedAt: string;
  UpdatedAt: string;
}

export interface RatingAnalytics {
  Id: number;
  ContentType: string;
  ContentId: number;
  AverageRating: number;
  TotalRatings: number;
  RatingDistribution: string; // JSON object
  LastCalculated: string;
}

export interface SubscriberAnnouncement {
  Id: number;
  HandleId: number;
  Title: string;
  Content: string;
  Link?: string;
  LinkText?: string;
  PublishedAt: string;
  ExpiresAt?: string;
  IsActive: boolean;
  Language: string;
}

export interface SubscriberPageView {
  Id: number;
  HandleId: number;
  ViewerEmail?: string;
  ViewerIp?: string;
  ViewerUserAgent?: string;
  PageType: 'internal' | 'external';
  ViewedAt: string;
  Referrer?: string;
  Language?: string;
}

export interface SubscriberModeration {
  Id: number;
  SubscriberEmail: string;
  IsBanned: boolean;
  CanPost: boolean;
  IsModerated: boolean;
  IsTracked: boolean;
  BanReason?: string;
  ModeratedBy?: string;
  ModeratedAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ContentModeration {
  Id: number;
  ContentType: 'blog_post' | 'announcement' | 'comment';
  ContentId: number;
  SubscriberEmail: string;
  Action: 'removed' | 'hidden' | 'flagged' | 'approved';
  Reason?: string;
  ModeratedBy?: string;
  ModeratedAt: string;
}

export interface HandleModeration {
  Id: number;
  HandleId: number;
  Action: 'suspended' | 'hidden' | 'flagged' | 'approved';
  Reason?: string;
  ModeratedBy?: string;
  ModeratedAt: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Handle Management
export interface CreateHandleRequest {
  handle: string;
  displayName: string;
  description?: string;
}

export interface UpdateHandleRequest {
  displayName?: string;
  description?: string;
  isActive?: boolean;
  isPublic?: boolean;
}

export interface HandleSuggestionRequest {
  baseName: string;
  suggestionType?: 'auto' | 'user_request' | 'system_generated';
}

export interface HandleValidationResponse {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
}

// Blog Post Management
export interface CreateBlogPostRequest {
  handleId: number;
  title: string;
  content: string;
  excerpt?: string;
  language?: string;
  tags?: string;
}

export interface UpdateBlogPostRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: 'draft' | 'published' | 'archived';
  language?: string;
  tags?: string;
}

export interface PublishBlogPostRequest {
  publishedAt?: string;
}

// Comment Management
export interface CreateCommentRequest {
  blogPostId: number;
  content: string;
  parentCommentId?: number;
  authorName: string;
}

export interface UpdateCommentRequest {
  content: string;
}

// Rating Management
export interface CreateRatingRequest {
  contentType: 'blog_post' | 'published_content';
  contentId: number;
  rating: number; // 1-5
  review?: string;
  raterName: string;
  language?: string;
}

export interface UpdateRatingRequest {
  rating?: number;
  review?: string;
}

// Announcement Management
export interface CreateAnnouncementRequest {
  handleId: number;
  title: string;
  content: string;
  link?: string;
  linkText?: string;
  expiresAt?: string;
  language?: string;
}

export interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
  link?: string;
  linkText?: string;
  isActive?: boolean;
  expiresAt?: string;
  language?: string;
}

// Page Configuration
export interface UpdatePageConfigRequest {
  sections: {
    sectionKey: string;
    isEnabled: boolean;
    sortOrder: number;
    customTitle?: string;
    customDescription?: string;
  }[];
}

// Moderation
export interface SubscriberModerationRequest {
  isBanned?: boolean;
  canPost?: boolean;
  isModerated?: boolean;
  isTracked?: boolean;
  banReason?: string;
}

export interface ContentModerationRequest {
  action: 'removed' | 'hidden' | 'flagged' | 'approved';
  reason?: string;
}

export interface HandleModerationRequest {
  action: 'suspended' | 'hidden' | 'flagged' | 'approved';
  reason?: string;
}

// =============================================================================
// PUBLIC API TYPES
// =============================================================================

export interface PublicHandleProfile {
  handle: string;
  displayName: string;
  description?: string;
  sections: PublicPageSection[];
  analytics?: {
    totalViews: number;
    totalPosts: number;
    totalComments: number;
    averageRating?: number;
  };
}

export interface PublicPageSection {
  key: string;
  title: string;
  description?: string;
  isEnabled: boolean;
  sortOrder: number;
  customTitle?: string;
  customDescription?: string;
}

export interface PublicBlogPost {
  id: number;
  title: string;
  content: string;
  excerpt?: string;
  publishedAt: string;
  language: string;
  tags?: string[];
  viewCount: number;
  averageRating?: number;
  totalRatings?: number;
  totalComments: number;
}

export interface PublicComment {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
  replies?: PublicComment[];
  isVerified?: boolean;
}

export interface PublicRating {
  id: number;
  raterName: string;
  rating: number;
  review?: string;
  createdAt: string;
  isVerified: boolean;
}

export interface PublicAnnouncement {
  id: number;
  title: string;
  content: string;
  link?: string;
  linkText?: string;
  publishedAt: string;
  expiresAt?: string;
  language: string;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface HandleAnalytics {
  handleId: number;
  handle: string;
  totalViews: number;
  uniqueVisitors: number;
  totalPosts: number;
  totalComments: number;
  totalRatings: number;
  averageRating?: number;
  viewsByDate: { date: string; views: number }[];
  topPosts: { id: number; title: string; views: number }[];
}

export interface ContentAnalytics {
  contentType: 'blog_post' | 'announcement' | 'comment' | 'rating';
  contentId: number;
  views: number;
  engagement: number;
  averageRating?: number;
  totalRatings?: number;
  totalComments?: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type HandleStatus = 'active' | 'inactive' | 'suspended' | 'hidden';
export type BlogPostStatus = 'draft' | 'published' | 'archived';
export type CommentStatus = 'approved' | 'pending' | 'archived' | 'flagged';
export type RatingStatus = 'approved' | 'flagged' | 'archived';
export type ModerationAction = 'removed' | 'hidden' | 'flagged' | 'approved' | 'suspended';

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

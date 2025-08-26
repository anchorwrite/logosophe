// Subscriber Pages Logging Utilities
// This file contains logging functions for all subscriber page actions

import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

// =============================================================================
// LOGGING FUNCTIONS FOR SUBSCRIBER PAGES
// =============================================================================

/**
 * Log handle management actions
 */
export async function logHandleAction(
  db: D1Database,
  action: 'subscriber_handle_created' | 'subscriber_handle_updated' | 'subscriber_handle_archived' | 'subscriber_handle_moderated' | 'subscriber_handle_deleted',
  handleId: string,
  subscriberEmail: string,
  metadata: {
    handle: string;
    displayName: string;
    description?: string;
    isActive?: boolean;
    isPublic?: boolean;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'write',
    targetId: handleId,
    targetName: `Handle: ${metadata.handle}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ...metadata
    }
  });
}

/**
 * Log blog post actions
 */
export async function logBlogPostAction(
  db: D1Database,
  action: 'blog_post_created' | 'blog_post_updated' | 'blog_post_published' | 'blog_post_archived' | 'blog_post_deleted',
  postId: string,
  subscriberEmail: string,
  metadata: {
    handleId: number;
    title: string;
    status: string;
    language?: string;
    tags?: string;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'write',
    targetId: postId,
    targetName: `Blog post: ${metadata.title}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ...metadata
    }
  });
}

/**
 * Log comment actions
 */
export async function logCommentAction(
  db: D1Database,
  action: 'blog_comment_created' | 'blog_comment_updated' | 'blog_comment_replied' | 'blog_comment_archived' | 'blog_comment_moderated',
  commentId: string,
  authorEmail: string,
  metadata: {
    blogPostId: number;
    parentCommentId?: number;
    status: string;
    content?: string;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: authorEmail,
    activityType: action,
    accessType: 'write',
    targetId: commentId,
    targetName: `Comment on blog post ${metadata.blogPostId}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ...metadata
    }
  });
}

/**
 * Log rating actions
 */
export async function logRatingAction(
  db: D1Database,
  action: 'content_rating_created' | 'content_rating_updated' | 'content_rating_deleted' | 'content_rating_moderated',
  ratingId: string,
  raterEmail: string | null,
  metadata: {
    contentType: string;
    contentId: number;
    rating: number;
    isVerified: boolean;
    review?: string;
    language?: string;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: raterEmail || 'anonymous',
    activityType: action,
    accessType: 'write',
    targetId: ratingId,
    targetName: `Rating: ${metadata.contentType} ${metadata.contentId}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ratingId,
      review: metadata.review,
      language: metadata.language,
      ...metadata
    }
  });
}

/**
 * Log announcement actions
 */
export async function logAnnouncementAction(
  db: D1Database,
  action: 'announcement_created' | 'announcement_updated' | 'announcement_archived',
  announcementId: string,
  subscriberEmail: string,
  metadata: {
    handleId: number;
    title: string;
    language?: string;
    isActive?: boolean;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'write',
    targetId: announcementId,
    targetName: `Announcement: ${metadata.title}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      announcementId,
      language: metadata.language,
      isActive: metadata.isActive,
      ...metadata
    }
  });
}

/**
 * Log page view actions
 */
export async function logPageViewAction(
  db: D1Database,
  handleId: string,
  viewerEmail: string | null,
  metadata: {
    pageType: 'internal' | 'external';
    referrer?: string;
    language?: string;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: viewerEmail || 'anonymous',
    activityType: 'subscriber_page_viewed',
    accessType: 'read',
    targetId: handleId,
    targetName: `Page View: ${metadata.pageType}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      handleId,
      referrer: metadata.referrer,
      language: metadata.language,
      ...metadata
    }
  });
}

/**
 * Log section view actions
 */
export async function logSectionViewAction(
  db: D1Database,
  handleId: string,
  sectionKey: string,
  viewerEmail: string | null,
  metadata: {
    pageType: 'internal' | 'external';
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: viewerEmail || 'anonymous',
    activityType: 'page_section_viewed',
    accessType: 'read',
    targetId: handleId,
    targetName: `Section: ${sectionKey}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      handleId,
      sectionKey,
      ...metadata
    }
  });
}

/**
 * Log contact form submissions
 */
export async function logContactFormSubmission(
  db: D1Database,
  handleId: string,
  submitterEmail: string | null,
  metadata: {
    messageLength: number;
    hasAttachments: boolean;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: submitterEmail || 'anonymous',
    activityType: 'contact_form_submitted',
    accessType: 'write',
    targetId: handleId,
    targetName: 'Contact Form Submission',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      handleId,
      ...metadata
    }
  });
}

/**
 * Log moderation actions
 */
export async function logModerationAction(
  db: D1Database,
  action: 'subscriber_moderated' | 'content_moderated' | 'handle_moderated',
  targetType: 'subscriber' | 'content' | 'handle',
  targetId: string,
  moderatorEmail: string,
  metadata: {
    action: string;
    reason?: string;
    contentType?: string;
    contentId?: number;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: moderatorEmail,
    activityType: action,
    accessType: 'write',
    targetId: targetId,
    targetName: `Moderation: ${targetType}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      targetId,
      moderationAction: metadata.action,
      reason: metadata.reason,
      contentType: metadata.contentType,
      contentId: metadata.contentId,
      ...metadata
    }
  });
}

/**
 * Log handle limit actions
 */
export async function logHandleLimitAction(
  db: D1Database,
  action: 'handle_limit_checked' | 'handle_limit_upgraded',
  subscriberEmail: string,
  metadata: {
    currentLimit: number;
    requestedLimit?: number;
    limitType?: string;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'read',
    targetId: 'handle_limit',
    targetName: 'Handle Limit Check',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ...metadata
    }
  });
}

/**
 * Log handle suggestion actions
 */
export async function logHandleSuggestionAction(
  db: D1Database,
  action: 'handle_suggestion_generated' | 'handle_suggestion_used',
  subscriberEmail: string,
  metadata: {
    baseName: string;
    suggestedHandle: string;
    suggestionType: string;
    isUsed?: boolean;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'read',
    targetId: 'handle_suggestion',
    targetName: 'Handle Suggestion',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      ...metadata
    }
  });
}

/**
 * Log page configuration actions
 */
export async function logPageConfigAction(
  db: D1Database,
  action: 'page_config_updated',
  handleId: string,
  subscriberEmail: string,
  metadata: {
    sectionsUpdated: number;
    sectionsEnabled: number;
    sectionsDisabled: number;
    [key: string]: any;
  },
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail: subscriberEmail,
    activityType: action,
    accessType: 'write',
    targetId: handleId,
    targetName: 'Page Configuration',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      handleId,
      ...metadata
    }
  });
}

// =============================================================================
// BULK LOGGING FUNCTIONS
// =============================================================================

/**
 * Log multiple actions in a batch
 */
export async function logBulkActions(
  db: D1Database,
  actions: Array<{
    action: string;
    target: string;
    userEmail: string;
    metadata: any;
  }>,
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  const logPromises = actions.map(({ action, target, userEmail, metadata }) =>
    normalizedLogging.logSystemOperations({
      userEmail,
      activityType: action,
      accessType: 'write',
      targetId: 'bulk_action',
      targetName: `Bulk Action: ${action}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ...metadata
      }
    })
  );
  
  await Promise.all(logPromises);
}

// =============================================================================
// ERROR LOGGING
// =============================================================================

/**
 * Log subscriber pages errors
 */
export async function logSubscriberPagesError(
  db: D1Database,
  error: Error,
  action: string,
  userEmail: string,
  metadata: any,
  request?: Request
) {
  const context = request ? extractRequestContext(request) : {};
  
  const normalizedLogging = new NormalizedLogging(db);
  
  await normalizedLogging.logSystemOperations({
    userEmail,
    activityType: 'error',
    accessType: 'write',
    targetId: 'error',
    targetName: 'Subscriber Pages Error',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      errorMessage: error.message,
      errorStack: error.stack,
      originalAction: action,
      ...metadata
    }
  });
}

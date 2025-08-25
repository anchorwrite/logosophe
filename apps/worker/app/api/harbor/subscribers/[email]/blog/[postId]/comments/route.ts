// Comment Management API Route
// GET: List comments for a blog post
// POST: Create a new comment

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { BlogComment, CreateCommentRequest, PaginationParams } from '@/types/subscriber-pages';
import { logCommentAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List comments for a blog post
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
) {
  const context = await getCloudflareContext({ async: true });
  const db = context.env.DB;
  
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { email, postId: postIdStr } = await params;
  const subscriberEmail = decodeURIComponent(email);
  const postId = parseInt(postIdStr);
  
  try {
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can view comments on their own posts, admins can view any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Parse filter parameters
    const status = searchParams.get('status') || 'approved';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Get comments from database
    const { comments, total } = await getBlogComments(
      db,
      postId, 
      subscriberEmail,
      { page, limit, offset },
      { status, includeArchived }
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching blog comments:', error);
    await logSubscriberPagesError(
      db,
      error as Error,
      'get_blog_comments',
      session?.user?.email || 'unknown',
      { subscriberEmail, postId },
      request
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Create a new comment
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
) {
  const context = await getCloudflareContext({ async: true });
  const db = context.env.DB;
  
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { email, postId: postIdStr } = await params;
  const subscriberEmail = decodeURIComponent(email);
  const postId = parseInt(postIdStr);
  
  try {
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can comment on their own posts, admins can comment on any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateCommentRequest = await request.json();
    
    // Validate request body
    const validation = validateCreateCommentRequest(body);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request', 
        details: validation.errors 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify post ownership
    const postOwnership = await verifyPostOwnership(db, postId, subscriberEmail);
    if (!postOwnership.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Post ownership verification failed', 
        details: postOwnership.errors 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify parent comment if provided
    if (body.parentCommentId) {
      const parentCommentVerification = await verifyParentComment(db, body.parentCommentId, postId);
      if (!parentCommentVerification.isValid) {
        return new Response(JSON.stringify({ 
          error: 'Parent comment verification failed', 
          details: parentCommentVerification.errors 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create comment
    const newComment = await createComment(db, postId, session.user.email, body);
    
    // Log the action
    await logCommentAction(
      db,
      body.parentCommentId ? 'blog_comment_replied' : 'blog_comment_created',
      newComment.Id.toString(),
      session.user.email,
      {
        blogPostId: postId,
        parentCommentId: body.parentCommentId,
        status: newComment.Status,
        content: newComment.Content
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: newComment,
      message: 'Comment created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    await logSubscriberPagesError(
      db,
      error as Error,
      'create_comment',
      session?.user?.email || 'unknown',
      { subscriberEmail, postId, requestBody: await request.json() },
      request
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function getBlogComments(
  db: D1Database,
  postId: number,
  subscriberEmail: string,
  pagination: PaginationParams,
  filters: { status: string; includeArchived: boolean }
): Promise<{ comments: ThreadedComment[], total: number }> {
  
  // Build WHERE clause
  const whereConditions = ['bc.BlogPostId = ?'];
  const params: (string | number)[] = [postId];
  
  if (filters.status) {
    whereConditions.push('bc.Status = ?');
    params.push(filters.status);
  }
  
  if (!filters.includeArchived) {
    whereConditions.push('bc.Status != "archived"');
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM BlogComments bc
    JOIN SubscriberBlogPosts sbp ON bc.BlogPostId = sbp.Id
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause} AND sh.SubscriberEmail = ?
  `;
  
  const countParams = [...params, subscriberEmail];
  const countResult = await db.prepare(countQuery).bind(...countParams).first();
  const total = (countResult as any).total;
  
  // Get comments with pagination
  const commentsQuery = `
    SELECT 
      bc.Id, bc.BlogPostId, bc.AuthorEmail, bc.AuthorName, bc.Content,
      bc.ParentCommentId, bc.Status, bc.IsModerated, bc.CreatedAt, bc.UpdatedAt
    FROM BlogComments bc
    JOIN SubscriberBlogPosts sbp ON bc.BlogPostId = sbp.Id
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause} AND sh.SubscriberEmail = ?
    ORDER BY bc.CreatedAt ASC
    LIMIT ? OFFSET ?
  `;
  
  const commentsParams = [...countParams, pagination.limit, pagination.offset];
  const commentsResult = await db.prepare(commentsQuery).bind(...commentsParams).all();
  
  // Build threaded structure
  const comments = buildThreadedComments(commentsResult.results as unknown as BlogComment[]);
  
  return {
    comments,
    total
  };
}

async function createComment(db: D1Database, postId: number, authorEmail: string, data: CreateCommentRequest): Promise<BlogComment> {
  
  const result = await db.prepare(`
    INSERT INTO BlogComments (BlogPostId, AuthorEmail, AuthorName, Content, ParentCommentId, Status)
    VALUES (?, ?, ?, ?, ?, 'approved')
    RETURNING Id, BlogPostId, AuthorEmail, AuthorName, Content, ParentCommentId, Status, IsModerated, CreatedAt, UpdatedAt
  `).bind(
    postId,
    authorEmail,
    data.authorName,
    data.content,
    data.parentCommentId || null
  ).first();
  
  return result as unknown as BlogComment;
}

async function verifyPostOwnership(db: D1Database, postId: number, subscriberEmail: string): Promise<{ isValid: boolean; errors: string[] }> {
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM SubscriberBlogPosts sbp
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE sbp.Id = ? AND sh.SubscriberEmail = ?
  `).bind(postId, subscriberEmail).first();
  
  const exists = (result as any).count > 0;
  
  if (!exists) {
    return {
      isValid: false,
      errors: ['Blog post not found or not owned by subscriber']
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}

async function verifyParentComment(db: D1Database, parentCommentId: number, postId: number): Promise<{ isValid: boolean; errors: string[] }> {
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM BlogComments 
    WHERE Id = ? AND BlogPostId = ? AND Status = 'approved'
  `).bind(parentCommentId, postId).first();
  
  const exists = (result as any).count > 0;
  
  if (!exists) {
    return {
      isValid: false,
      errors: ['Parent comment not found or not approved']
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

interface ThreadedComment extends BlogComment {
  replies: ThreadedComment[];
}

function buildThreadedComments(comments: BlogComment[]): ThreadedComment[] {
  const commentMap = new Map<number, ThreadedComment>();
  const rootComments: ThreadedComment[] = [];
  
  // Create a map of all comments
  comments.forEach(comment => {
    commentMap.set(comment.Id, { ...comment, replies: [] });
  });
  
  // Build threaded structure
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.Id)!;
    
    if (comment.ParentCommentId) {
      // This is a reply
      const parentComment = commentMap.get(comment.ParentCommentId);
      if (parentComment) {
        parentComment.replies.push(commentWithReplies);
      }
    } else {
      // This is a root comment
      rootComments.push(commentWithReplies);
    }
  });
  
  return rootComments;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateCreateCommentRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.content || typeof data.content !== 'string') {
    errors.push('Content is required and must be a string');
  } else {
    const content = data.content.trim();
    
    if (content.length < 1) {
      errors.push('Content cannot be empty');
    }
    
    if (content.length > 2000) {
      errors.push('Content must be no more than 2,000 characters long');
    }
  }
  
  if (!data.authorName || typeof data.authorName !== 'string') {
    errors.push('Author name is required and must be a string');
  } else {
    const authorName = data.authorName.trim();
    
    if (authorName.length < 1) {
      errors.push('Author name cannot be empty');
    }
    
    if (authorName.length > 100) {
      errors.push('Author name must be no more than 100 characters long');
    }
  }
  
  if (data.parentCommentId !== undefined) {
    if (typeof data.parentCommentId !== 'number' || data.parentCommentId <= 0) {
      errors.push('Parent comment ID must be a positive number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

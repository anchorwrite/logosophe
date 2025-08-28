// Blog Post Management API Route
// GET: List blog posts for a subscriber across all handles
// POST: Create a new blog post

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberBlogPost, CreateBlogPostRequest, UpdateBlogPostRequest, PaginationParams, FilterParams } from '@/types/subscriber-pages';
import { logBlogPostAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List blog posts for a subscriber
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email } = await params;
    const subscriberEmail = decodeURIComponent(email);
    
    // Check access: subscriber can view their own posts, admins can view any
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Parse filter parameters
    const status = searchParams.get('status');
    const language = searchParams.get('language');
    const handleId = searchParams.get('handleId');
    const search = searchParams.get('search');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Get blog posts from database
    const { posts, total } = await getSubscriberBlogPosts(
      db,
      subscriberEmail, 
      { page, limit, offset },
      { 
        status: status || undefined, 
        language: language || undefined, 
        search: search || undefined 
      }
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: posts,
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
    console.error('Error fetching subscriber blog posts:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Create a new blog post
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email } = await params;
    const subscriberEmail = decodeURIComponent(email);
    
    // Check access: subscriber can create their own posts, admins can create for any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateBlogPostRequest = await request.json();
    
    // Validate request body
    const validation = validateCreateBlogPostRequest(body);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request', 
        details: validation.errors 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify handle ownership
    const handleOwnership = await verifyHandleOwnership(db, subscriberEmail, body.handleId);
    if (!handleOwnership.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Handle ownership verification failed', 
        details: handleOwnership.errors 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create blog post
    const newPost = await createBlogPost(db, subscriberEmail, body);
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_created',
      newPost.Id.toString(),
      subscriberEmail,
      {
        handleId: newPost.HandleId.toString(),
        title: newPost.Title,
        status: newPost.Status,
        language: newPost.Language,
        tags: newPost.Tags
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: newPost,
      message: 'Blog post created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function getSubscriberBlogPosts(
  db: D1Database,
  subscriberEmail: string,
  pagination: PaginationParams,
  filters: FilterParams
): Promise<{ posts: SubscriberBlogPost[], total: number }> {
  
  // Build WHERE clause
  const whereConditions = ['sh.SubscriberEmail = ?'];
  const params = [subscriberEmail];
  
  // Status filter is handled separately below to properly include archived posts
  
  if (filters.language) {
    whereConditions.push('sbp.Language = ?');
    params.push(filters.language);
  }
  
  if (filters.search) {
    whereConditions.push('(sbp.Title LIKE ? OR sbp.Content LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  // Only exclude archived posts if status filter is specifically set to exclude them
  if (filters.status && filters.status !== 'all' && filters.status !== 'archived') {
    whereConditions.push('sbp.Status = ?');
    params.push(filters.status);
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM SubscriberBlogPosts sbp
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause}
  `;
  
  const countResult = await db.prepare(countQuery).bind(...params).first();
  const total = (countResult as any).total;
  
  // Get posts with pagination
  const postsQuery = `
    SELECT 
      sbp.Id, sbp.HandleId, sbp.Title, sbp.Content, sbp.Excerpt,
      sbp.Status, sbp.PublishedAt, sbp.Language, sbp.Tags,
      sbp.ViewCount, sbp.CreatedAt, sbp.UpdatedAt,
      sh.Handle, sh.DisplayName as HandleDisplayName
    FROM SubscriberBlogPosts sbp
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause}
    ORDER BY sbp.CreatedAt DESC
    LIMIT ? OFFSET ?
  `;
  
  const postsParams = [...params, pagination.limit, pagination.offset];
  const postsResult = await db.prepare(postsQuery).bind(...postsParams).all();
  
  return {
    posts: postsResult.results as unknown as SubscriberBlogPost[],
    total
  };
}

async function createBlogPost(db: D1Database, subscriberEmail: string, data: CreateBlogPostRequest): Promise<SubscriberBlogPost> {
  
  const result = await db.prepare(`
    INSERT INTO SubscriberBlogPosts (HandleId, Title, Content, Excerpt, Status, Language, Tags)
    VALUES (?, ?, ?, ?, 'draft', ?, ?)
    RETURNING Id, HandleId, Title, Content, Excerpt, Status, PublishedAt, Language, Tags, ViewCount, CreatedAt, UpdatedAt
  `).bind(
    data.handleId,
    data.title,
    data.content,
    data.excerpt || null,
    data.language || 'en',
    data.tags || null
  ).first();
  
  return result as unknown as SubscriberBlogPost;
}

async function verifyHandleOwnership(db: D1Database, subscriberEmail: string, handleId: number): Promise<{ isValid: boolean; errors: string[] }> {
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM SubscriberHandles 
    WHERE Id = ? AND SubscriberEmail = ? AND IsActive = TRUE
  `).bind(handleId, subscriberEmail).first();
  
  const exists = (result as any).count > 0;
  
  if (!exists) {
    return {
      isValid: false,
      errors: ['Handle not found or not owned by subscriber']
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateCreateBlogPostRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.handleId || typeof data.handleId !== 'number') {
    errors.push('Handle ID is required and must be a number');
  }
  
  if (!data.title || typeof data.title !== 'string') {
    errors.push('Title is required and must be a string');
  } else {
    const title = data.title.trim();
    
    if (title.length < 1) {
      errors.push('Title cannot be empty');
    }
    
    if (title.length > 200) {
      errors.push('Title must be no more than 200 characters long');
    }
  }
  
  if (!data.content || typeof data.content !== 'string') {
    errors.push('Content is required and must be a string');
  } else {
    const content = data.content.trim();
    
    if (content.length < 1) {
      errors.push('Content cannot be empty');
    }
    
    if (content.length > 50000) {
      errors.push('Content must be no more than 50,000 characters long');
    }
  }
  
  if (data.excerpt && typeof data.excerpt === 'string') {
    if (data.excerpt.length > 500) {
      errors.push('Excerpt must be no more than 500 characters long');
    }
  }
  
  if (data.language && typeof data.language === 'string') {
    const validLanguages = ['en', 'es', 'fr', 'de', 'nl'];
    if (!validLanguages.includes(data.language)) {
      errors.push('Language must be one of: en, es, fr, de, nl');
    }
  }
  
  if (data.tags && typeof data.tags === 'string') {
    if (data.tags.length > 1000) {
      errors.push('Tags must be no more than 1,000 characters long');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

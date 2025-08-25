// Individual Blog Post Management API Route
// GET: Get a specific blog post
// PUT: Update a blog post
// DELETE: Archive a blog post

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberBlogPost, UpdateBlogPostRequest, PublishBlogPostRequest } from '@/types/subscriber-pages';
import { logBlogPostAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - Get a specific blog post
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
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

    const { email, postId: postIdStr } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postId = parseInt(postIdStr);
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can view their own posts, admins can view any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get blog post from database
    const post = await getBlogPost(db, postId, subscriberEmail);
    
    if (!post) {
      return new Response(JSON.stringify({ error: 'Blog post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: post
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// PUT - Update a blog post
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
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

    const { email, postId: postIdStr } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postId = parseInt(postIdStr);
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can update their own posts, admins can update any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: UpdateBlogPostRequest = await request.json();
    
    // Validate request body
    const validation = validateUpdateBlogPostRequest(body);
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

    // Update blog post
    const updatedPost = await updateBlogPost(db, postId, body);
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_updated',
      postId.toString(),
      subscriberEmail,
      {
        handleId: updatedPost.HandleId,
        title: updatedPost.Title,
        status: updatedPost.Status,
        language: updatedPost.Language,
        tags: updatedPost.Tags
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: updatedPost,
      message: 'Blog post updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DELETE - Archive a blog post (soft delete)
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
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

    const { email, postId: postIdStr } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postId = parseInt(postIdStr);
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can archive their own posts, admins can archive any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
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

    // Archive blog post
    const archivedPost = await archiveBlogPost(db, postId);
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_archived',
      postId.toString(),
      subscriberEmail,
      {
        handleId: archivedPost.HandleId,
        title: archivedPost.Title,
        status: archivedPost.Status
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: archivedPost,
      message: 'Blog post archived successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error archiving blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// PATCH - Publish a blog post
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
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

    const { email, postId: postIdStr } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postId = parseInt(postIdStr);
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can publish their own posts, admins can publish any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: PublishBlogPostRequest = await request.json();
    
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

    // Publish blog post
    const publishedPost = await publishBlogPost(db, postId, body.publishedAt);
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_published',
      postId.toString(),
      subscriberEmail,
      {
        handleId: publishedPost.HandleId,
        title: publishedPost.Title,
        status: publishedPost.Status,
        publishedAt: publishedPost.PublishedAt
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: publishedPost,
      message: 'Blog post published successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error publishing blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function getBlogPost(db: D1Database, postId: number, subscriberEmail: string): Promise<SubscriberBlogPost | null> {
  
  const result = await db.prepare(`
    SELECT 
      sbp.Id, sbp.HandleId, sbp.Title, sbp.Content, sbp.Excerpt,
      sbp.Status, sbp.PublishedAt, sbp.Language, sbp.Tags,
      sbp.ViewCount, sbp.CreatedAt, sbp.UpdatedAt,
      sh.Handle, sh.DisplayName as HandleDisplayName
    FROM SubscriberBlogPosts sbp
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE sbp.Id = ? AND sh.SubscriberEmail = ?
  `).bind(postId, subscriberEmail).first();
  
  return result as unknown as SubscriberBlogPost || null;
}

async function updateBlogPost(db: D1Database, postId: number, data: UpdateBlogPostRequest): Promise<SubscriberBlogPost> {
  
  // Build update fields
  const updateFields = [];
  const params = [];
  
  if (data.title !== undefined) {
    updateFields.push('Title = ?');
    params.push(data.title);
  }
  
  if (data.content !== undefined) {
    updateFields.push('Content = ?');
    params.push(data.content);
  }
  
  if (data.excerpt !== undefined) {
    updateFields.push('Excerpt = ?');
    params.push(data.excerpt);
  }
  
  if (data.status !== undefined) {
    updateFields.push('Status = ?');
    params.push(data.status);
  }
  
  if (data.language !== undefined) {
    updateFields.push('Language = ?');
    params.push(data.language);
  }
  
  if (data.tags !== undefined) {
    updateFields.push('Tags = ?');
    params.push(data.tags);
  }
  
  updateFields.push('UpdatedAt = CURRENT_TIMESTAMP');
  params.push(postId);
  
  const result = await db.prepare(`
    UPDATE SubscriberBlogPosts 
    SET ${updateFields.join(', ')}
    WHERE Id = ?
    RETURNING Id, HandleId, Title, Content, Excerpt, Status, PublishedAt, Language, Tags, ViewCount, CreatedAt, UpdatedAt
  `).bind(...params).first();
  
  return result as unknown as SubscriberBlogPost;
}

async function archiveBlogPost(db: D1Database, postId: number): Promise<SubscriberBlogPost> {
  
  const result = await db.prepare(`
    UPDATE SubscriberBlogPosts 
    SET Status = 'archived', UpdatedAt = CURRENT_TIMESTAMP
    WHERE Id = ?
    RETURNING Id, HandleId, Title, Content, Excerpt, Status, PublishedAt, Language, Tags, ViewCount, CreatedAt, UpdatedAt
  `).bind(postId).first();
  
  return result as unknown as SubscriberBlogPost;
}

async function publishBlogPost(db: D1Database, postId: number, publishedAt?: string): Promise<SubscriberBlogPost> {
  
  const publishDate = publishedAt || new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE SubscriberBlogPosts 
    SET Status = 'published', PublishedAt = ?, UpdatedAt = CURRENT_TIMESTAMP
    WHERE Id = ?
    RETURNING Id, HandleId, Title, Content, Excerpt, Status, PublishedAt, Language, Tags, ViewCount, CreatedAt, UpdatedAt
  `).bind(publishDate, postId).first();
  
  return result as unknown as SubscriberBlogPost;
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

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateUpdateBlogPostRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.title !== undefined && typeof data.title === 'string') {
    const title = data.title.trim();
    
    if (title.length < 1) {
      errors.push('Title cannot be empty');
    }
    
    if (title.length > 200) {
      errors.push('Title must be no more than 200 characters long');
    }
  }
  
  if (data.content !== undefined && typeof data.content === 'string') {
    const content = data.content.trim();
    
    if (content.length < 1) {
      errors.push('Content cannot be empty');
    }
    
    if (content.length > 50000) {
      errors.push('Content must be no more than 50,000 characters long');
    }
  }
  
  if (data.excerpt !== undefined && typeof data.excerpt === 'string') {
    if (data.excerpt.length > 500) {
      errors.push('Excerpt must be no more than 500 characters long');
    }
  }
  
  if (data.status !== undefined && typeof data.status === 'string') {
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(data.status)) {
      errors.push('Status must be one of: draft, published, archived');
    }
  }
  
  if (data.language !== undefined && typeof data.language === 'string') {
    const validLanguages = ['en', 'es', 'fr', 'de', 'nl'];
    if (!validLanguages.includes(data.language)) {
      errors.push('Language must be one of: en, es, fr, de, nl');
    }
  }
  
  if (data.tags !== undefined && typeof data.tags === 'string') {
    if (data.tags.length > 1000) {
      errors.push('Tags must be no more than 1,000 characters long');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

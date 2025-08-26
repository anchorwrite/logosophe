// Individual Blog Post Management API Route
// GET: Get specific blog post details
// PUT: Update blog post
// DELETE: Soft-delete (archive) blog post

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberBlogPost, UpdateBlogPostRequest } from '@/types/subscriber-pages';
import { logBlogPostAction } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - Get specific blog post details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const { email, postId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postIdNum = parseInt(postId);
    
    if (isNaN(postIdNum)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get blog post with handle information
    const postQuery = await db.prepare(`
      SELECT 
        sbp.*,
        sh.Handle,
        sh.DisplayName as HandleDisplayName
      FROM SubscriberBlogPosts sbp
      JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sbp.Id = ? AND sbp.SubscriberEmail = ?
    `).bind(postIdNum, subscriberEmail).first();
    
    if (!postQuery) {
      return new Response(JSON.stringify({ error: 'Blog post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const post = postQuery as unknown as SubscriberBlogPost;
    
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
// PUT - Update blog post
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

    const { email, postId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postIdNum = parseInt(postId);
    
    if (isNaN(postIdNum)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can edit their own posts, admins can edit any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify post exists and belongs to this subscriber
    const existingPost = await db.prepare(`
      SELECT * FROM SubscriberBlogPosts 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(postIdNum, subscriberEmail).first();
    
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Blog post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: UpdateBlogPostRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the blog post
    const updateResult = await db.prepare(`
      UPDATE SubscriberBlogPosts 
      SET 
        Title = ?,
        Content = ?,
        Excerpt = ?,
        Language = ?,
        Tags = ?,
        Status = ?,
        UpdatedAt = datetime('now')
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(
      body.title,
      body.content,
      body.excerpt || null,
      body.language || 'en',
      body.tags || null,
      body.status || existingPost.Status,
      postIdNum,
      subscriberEmail
    ).run();
    
    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to update blog post' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get updated post
    const updatedPost = await db.prepare(`
      SELECT 
        sbp.*,
        sh.Handle,
        sh.DisplayName as HandleDisplayName
      FROM SubscriberBlogPosts sbp
      JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sbp.Id = ?
    `).bind(postIdNum).first();
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_updated',
      postIdNum.toString(),
      subscriberEmail,
      {
        handleId: existingPost.HandleId as number,
        title: body.title,
        status: body.status || (existingPost.Status as string),
        language: body.language || (existingPost.Language as string),
        tags: body.tags
      },
      request
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: updatedPost
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
// DELETE - Soft-delete (archive) blog post
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

    const { email, postId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const postIdNum = parseInt(postId);
    
    if (isNaN(postIdNum)) {
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

    // Verify post exists and belongs to this subscriber
    const existingPost = await db.prepare(`
      SELECT * FROM SubscriberBlogPosts 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(postIdNum, subscriberEmail).first();
    
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Blog post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Soft-delete by setting status to 'archived'
    const archiveResult = await db.prepare(`
      UPDATE SubscriberBlogPosts 
      SET 
        Status = 'archived',
        UpdatedAt = datetime('now')
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(postIdNum, subscriberEmail).run();
    
    if (archiveResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to archive blog post' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_archived',
      postIdNum.toString(),
      subscriberEmail,
      {
        handleId: existingPost.HandleId as number,
        title: existingPost.Title as string,
        status: 'archived',
        previousStatus: existingPost.Status as string
      },
      request
    );
    
    return new Response(JSON.stringify({
      success: true,
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

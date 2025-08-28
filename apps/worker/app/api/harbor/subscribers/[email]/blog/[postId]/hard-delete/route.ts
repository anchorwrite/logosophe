// Hard Delete Blog Post API Route
// DELETE: Permanently delete blog post and all associated data

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { logBlogPostAction } from '@/lib/subscriber-pages-logging';

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
    
    // Check access: subscriber can delete their own posts, admins can delete any
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
      SELECT sbp.*, sh.SubscriberEmail 
      FROM SubscriberBlogPosts sbp
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sbp.Id = ? AND sh.SubscriberEmail = ?
    `).bind(postIdNum, subscriberEmail).first();
    
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Blog post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the action before deletion
    await logBlogPostAction(
      db,
      'blog_post_hard_deleted',
      postIdNum.toString(),
      subscriberEmail,
      {
        handleId: (existingPost as any).HandleId.toString(),
        title: existingPost.Title as string,
        status: 'hard_deleted',
        previousStatus: existingPost.Status as string
      },
      request
    );

    // Delete in order to maintain referential integrity
    // 1. Delete content links
    await db.prepare(`
      DELETE FROM ContentLinks 
      WHERE ContentType = 'blog_post' AND ContentId = ?
    `).bind(postIdNum).run();

    // 2. Delete comments
    await db.prepare(`
      DELETE FROM BlogComments 
      WHERE BlogPostId = ?
    `).bind(postIdNum).run();

    // 3. Delete ratings
    await db.prepare(`
      DELETE FROM ContentRatings 
      WHERE ContentType = 'blog_post' AND ContentId = ?
    `).bind(postIdNum).run();

    // 4. Finally delete the blog post
    const deleteResult = await db.prepare(`
      DELETE FROM SubscriberBlogPosts 
      WHERE Id = ?
    `).bind(postIdNum).run();
    
    if (deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to delete blog post' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Blog post permanently deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error hard deleting blog post:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

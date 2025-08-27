// Public Blog Post API Route
// GET: Get individual blog post details

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SubscriberBlogPost } from '@/types/subscriber-pages';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; postId: string }> }
) {
  try {
    const { handle, postId } = await params;
    const postIdNum = parseInt(postId, 10);
    
    if (isNaN(postIdNum)) {
      return Response.json(
        { success: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Verify the blog post exists and is published
    const postResult = await db.prepare(`
      SELECT 
        sbp.Id, sbp.HandleId, sbp.Title, sbp.Content, sbp.Excerpt, 
        sbp.Status, sbp.PublishedAt, sbp.Language, sbp.Tags, 
        sbp.ViewCount, sbp.CreatedAt, sbp.UpdatedAt,
        sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberBlogPosts sbp
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sbp.Id = ? AND sbp.Status = 'published' AND sh.IsActive = 1 AND sh.IsPublic = 1
    `).bind(handle, postIdNum).first();

    if (!postResult) {
      return Response.json(
        { success: false, error: 'Blog post not found or not published' },
        { status: 404 }
      );
    }

    // Increment view count
    await db.prepare(`
      UPDATE SubscriberBlogPosts 
      SET ViewCount = ViewCount + 1 
      WHERE Id = ?
    `).bind(postIdNum).run();

    // Get updated view count
    const updatedViewCount = await db.prepare(`
      SELECT ViewCount FROM SubscriberBlogPosts WHERE Id = ?
    `).bind(postIdNum).first();

    const blogPost: SubscriberBlogPost = {
      Id: postResult.Id as number,
      HandleId: postResult.HandleId as number,
      Title: postResult.Title as string,
      Content: postResult.Content as string,
      Excerpt: postResult.Excerpt as string | undefined,
      Status: postResult.Status as 'draft' | 'published' | 'archived',
      PublishedAt: postResult.PublishedAt as string | undefined,
      Language: postResult.Language as string,
      Tags: postResult.Tags as string | undefined,
      ViewCount: (updatedViewCount as any).ViewCount as number,
      CreatedAt: postResult.CreatedAt as string,
      UpdatedAt: postResult.UpdatedAt as string
    };

    return Response.json({
      success: true,
      data: blogPost
    });

  } catch (error) {
    console.error('Error fetching blog post:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

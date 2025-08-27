import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import { logPageViewAction } from '@/lib/subscriber-pages-logging';

export async function POST(
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
      SELECT sbp.Id, sbp.Title, sbp.ViewCount, sh.Handle, sh.DisplayName
      FROM SubscriberBlogPosts sbp
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sbp.Id = ? AND sbp.Status = 'published'
    `).bind(handle, postIdNum).first();

    if (!postResult) {
      return Response.json(
        { success: false, error: 'Blog post not found or not published' },
        { status: 404 }
      );
    }

    // Increment the view count
    const updateResult = await db.prepare(`
      UPDATE SubscriberBlogPosts 
      SET ViewCount = ViewCount + 1, UpdatedAt = CURRENT_TIMESTAMP
      WHERE Id = ?
    `).bind(postIdNum).run();

    if (!updateResult.success) {
      console.error('Database error updating view count:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update view count' },
        { status: 500 }
      );
    }

    // Log the page view action
    await logPageViewAction(
      db,
      postIdNum.toString(),
      null, // Anonymous view
      {
        pageType: 'external',
        handle: handle,
        postTitle: (postResult as any).Title,
        handleDisplayName: (postResult as any).DisplayName
      }
    );

    // Get the updated view count
    const updatedPostResult = await db.prepare(`
      SELECT ViewCount FROM SubscriberBlogPosts WHERE Id = ?
    `).bind(postIdNum).first();

    return Response.json({
      success: true,
      data: {
        viewCount: (updatedPostResult as any).ViewCount
      }
    });

  } catch (error) {
    console.error('Error tracking blog post view:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

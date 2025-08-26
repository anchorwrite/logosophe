import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { D1Database } from '@cloudflare/workers-types';
import { logBlogPostAction } from '@/lib/subscriber-pages-logging';

interface CreateCommentRequest {
  content: string;
  parentCommentId?: number | null;
}

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
    
    // Get comments for the blog post
    const commentsResult = await db.prepare(`
      SELECT 
        c.Id,
        c.BlogPostId,
        c.AuthorEmail,
        c.AuthorName,
        c.Content,
        c.ParentCommentId,
        c.Status,
        c.IsModerated,
        c.CreatedAt,
        c.UpdatedAt
      FROM BlogComments c
      INNER JOIN SubscriberBlogPosts sbp ON c.BlogPostId = sbp.Id
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sbp.Id = ? AND c.Status = 'approved'
      ORDER BY c.CreatedAt ASC
    `).bind(handle, postIdNum).all();

    if (!commentsResult.success) {
      console.error('Database error fetching comments:', commentsResult.error);
      return Response.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: commentsResult.results
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const session = await auth();
    if (!session?.user?.email) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateCommentRequest = await request.json();
    const { content, parentCommentId } = body;

    if (!content || !content.trim()) {
      return Response.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Verify the blog post exists and is published
    const postResult = await db.prepare(`
      SELECT sbp.Id, sbp.Status, sh.Handle
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

    // If this is a reply, verify the parent comment exists
    if (parentCommentId) {
      const parentCommentResult = await db.prepare(`
        SELECT Id, Status FROM BlogComments 
        WHERE Id = ? AND BlogPostId = ? AND Status = 'approved'
      `).bind(parentCommentId, postIdNum).first();

      if (!parentCommentResult) {
        return Response.json(
          { success: false, error: 'Parent comment not found or not approved' },
          { status: 400 }
        );
      }
    }

    // Get user's name from Subscribers table
    const subscriberResult = await db.prepare(`
      SELECT Name FROM Subscribers WHERE Email = ?
    `).bind(session.user.email).first();

    const authorName = subscriberResult?.Name || 'Anonymous';

    // Insert the comment
    const insertResult = await db.prepare(`
      INSERT INTO BlogComments (
        BlogPostId, AuthorEmail, AuthorName, Content, 
        ParentCommentId, Status, IsModerated, CreatedAt, UpdatedAt
      ) VALUES (?, ?, ?, ?, ?, 'approved', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      postIdNum,
      session.user.email,
      authorName,
      content.trim(),
      parentCommentId || null
    ).run();

    if (!insertResult.success) {
      console.error('Database error inserting comment:', insertResult.error);
      return Response.json(
        { success: false, error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    const commentId = insertResult.meta.last_row_id;

    // Log the comment creation
    await logBlogPostAction(
      db,
      'subscriber_comment_created',
      postIdNum.toString(),
      session.user.email,
      {
        handleId: (postResult as any).Id.toString(),
        status: 'approved',
        metadata: {
          commentId: commentId.toString(),
          parentCommentId: parentCommentId?.toString() || null,
          contentLength: content.trim().length
        }
      }
    );

    return Response.json({
      success: true,
      data: {
        id: commentId,
        blogPostId: postIdNum,
        authorEmail: session.user.email,
        authorName,
        content: content.trim(),
        parentCommentId,
        status: 'approved',
        isModerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

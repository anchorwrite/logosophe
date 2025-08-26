import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { D1Database } from '@cloudflare/workers-types';
import { logBlogPostAction } from '@/lib/subscriber-pages-logging';

interface UpdateCommentRequest {
  content: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; postId: string; commentId: string }> }
) {
  try {
    const { handle, postId, commentId } = await params;
    const postIdNum = parseInt(postId, 10);
    const commentIdNum = parseInt(commentId, 10);
    
    if (isNaN(postIdNum) || isNaN(commentIdNum)) {
      return Response.json(
        { success: false, error: 'Invalid post ID or comment ID' },
        { status: 400 }
      );
    }

    const db = (request as any).env.DB as D1Database;
    
    // Get the specific comment
    const commentResult = await db.prepare(`
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
      WHERE sh.Handle = ? AND sbp.Id = ? AND c.Id = ? AND c.Status = 'approved'
    `).bind(handle, postIdNum, commentIdNum).first();

    if (!commentResult) {
      return Response.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: commentResult
    });

  } catch (error) {
    console.error('Error fetching comment:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; postId: string; commentId: string }> }
) {
  try {
    const { handle, postId, commentId } = await params;
    const postIdNum = parseInt(postId, 10);
    const commentIdNum = parseInt(commentId, 10);
    
    if (isNaN(postIdNum) || isNaN(commentIdNum)) {
      return Response.json(
        { success: false, error: 'Invalid post ID or comment ID' },
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

    const body: UpdateCommentRequest = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return Response.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    const db = (request as any).env.DB as D1Database;
    
    // Verify the comment exists and belongs to the user
    const commentResult = await db.prepare(`
      SELECT c.*, sbp.Id as PostId, sh.Handle
      FROM BlogComments c
      INNER JOIN SubscriberBlogPosts sbp ON c.BlogPostId = sbp.Id
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sbp.Id = ? AND c.Id = ? AND c.Status = 'approved'
    `).bind(handle, postIdNum, commentIdNum).first();

    if (!commentResult) {
      return Response.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (commentResult.AuthorEmail !== session.user.email) {
      return Response.json(
        { success: false, error: 'You can only edit your own comments' },
        { status: 403 }
      );
    }

    // Update the comment
    const updateResult = await db.prepare(`
      UPDATE BlogComments 
      SET Content = ?, UpdatedAt = CURRENT_TIMESTAMP
      WHERE Id = ?
    `).bind(content.trim(), commentIdNum).run();

    if (!updateResult.success) {
      console.error('Database error updating comment:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    // Log the comment update
    await logBlogPostAction(
      db,
      'subscriber_comment_updated',
      postIdNum.toString(),
      session.user.email,
      {
        handleId: (commentResult as any).PostId.toString(),
        status: 'approved',
        metadata: {
          commentId: commentIdNum.toString(),
          contentLength: content.trim().length,
          previousContent: (commentResult as any).Content
        }
      }
    );

    return Response.json({
      success: true,
      data: {
        id: commentIdNum,
        blogPostId: postIdNum,
        authorEmail: commentResult.AuthorEmail,
        authorName: commentResult.AuthorName,
        content: content.trim(),
        parentCommentId: commentResult.ParentCommentId,
        status: commentResult.Status,
        isModerated: commentResult.IsModerated,
        createdAt: commentResult.CreatedAt,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; postId: string; commentId: string }> }
) {
  try {
    const { handle, postId, commentId } = await params;
    const postIdNum = parseInt(postId, 10);
    const commentIdNum = parseInt(commentId, 10);
    
    if (isNaN(postIdNum) || isNaN(commentIdNum)) {
      return Response.json(
        { success: false, error: 'Invalid post ID or comment ID' },
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

    const db = (request as any).env.DB as D1Database;
    
    // Verify the comment exists and belongs to the user
    const commentResult = await db.prepare(`
      SELECT c.*, sbp.Id as PostId, sh.Handle
      FROM BlogComments c
      INNER JOIN SubscriberBlogPosts sbp ON c.BlogPostId = sbp.Id
      INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sbp.Id = ? AND c.Id = ? AND c.Status = 'approved'
    `).bind(handle, postIdNum, commentIdNum).first();

    if (!commentResult) {
      return Response.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (commentResult.AuthorEmail !== session.user.email) {
      return Response.json(
        { success: false, error: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

    // Soft delete the comment by setting status to archived
    const deleteResult = await db.prepare(`
      UPDATE BlogComments 
      SET Status = 'archived', UpdatedAt = CURRENT_TIMESTAMP
      WHERE Id = ?
    `).bind(commentIdNum).run();

    if (!deleteResult.success) {
      console.error('Database error archiving comment:', deleteResult.error);
      return Response.json(
        { success: false, error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    // Log the comment deletion
    await logBlogPostAction(
      db,
      'subscriber_comment_archived',
      postIdNum.toString(),
      session.user.email,
      {
        handleId: (commentResult as any).PostId.toString(),
        status: 'archived',
        metadata: {
          commentId: commentIdNum.toString(),
          previousStatus: 'approved'
        }
      }
    );

    return Response.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

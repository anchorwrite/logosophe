import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { D1Database } from '@cloudflare/workers-types';
import { logBlogPostAction } from '@/lib/subscriber-pages-logging';

export async function POST(
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
    
    // Verify the comment exists
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

    // Don't allow users to flag their own comments
    if (commentResult.AuthorEmail === session.user.email) {
      return Response.json(
        { success: false, error: 'You cannot flag your own comments' },
        { status: 400 }
      );
    }

    // Flag the comment for moderation
    const flagResult = await db.prepare(`
      UPDATE BlogComments 
      SET Status = 'flagged', IsModerated = TRUE, UpdatedAt = CURRENT_TIMESTAMP
      WHERE Id = ?
    `).bind(commentIdNum).run();

    if (!flagResult.success) {
      console.error('Database error flagging comment:', flagResult.error);
      return Response.json(
        { success: false, error: 'Failed to flag comment' },
        { status: 500 }
      );
    }

    // Log the comment flagging
    await logBlogPostAction(
      db,
      'subscriber_comment_flagged',
      postIdNum.toString(),
      session.user.email,
      {
        handleId: (commentResult as any).PostId.toString(),
        status: 'flagged',
        metadata: {
          commentId: commentIdNum.toString(),
          flaggedBy: session.user.email,
          previousStatus: 'approved',
          commentAuthor: commentResult.AuthorEmail
        }
      }
    );

    return Response.json({
      success: true,
      message: 'Comment flagged for moderation'
    });

  } catch (error) {
    console.error('Error flagging comment:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

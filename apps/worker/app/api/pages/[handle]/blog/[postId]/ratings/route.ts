// Public Rating API Route
// GET: List ratings for a blog post (public access)
// POST: Create a new rating (requires signin)

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { ContentRating, CreateRatingRequest } from '@/types/subscriber-pages';
import { logRatingAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List ratings for a blog post (public access)
// =============================================================================

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

    // Get approved ratings for this post
    const ratingsResult = await db.prepare(`
      SELECT 
        cr.Id, cr.ContentType, cr.ContentId, cr.RaterEmail, cr.RaterName,
        cr.Rating, cr.Review, cr.Language, cr.IsVerified, cr.Status,
        cr.CreatedAt, cr.UpdatedAt
      FROM ContentRatings cr
      WHERE cr.ContentId = ? AND cr.ContentType = 'blog_post' AND cr.Status = 'approved'
      ORDER BY cr.CreatedAt DESC
    `).bind(postIdNum).all();

    const ratings = ratingsResult.results as unknown as ContentRating[];

    // Get rating analytics
    const analyticsResult = await db.prepare(`
      SELECT AverageRating, TotalRatings, RatingDistribution, LastCalculated
      FROM RatingAnalytics 
      WHERE ContentId = ? AND ContentType = 'blog_post'
    `).bind(postIdNum).first();

    let analytics = {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: {},
      lastCalculated: null
    };

    if (analyticsResult) {
      analytics = {
        averageRating: parseFloat((analyticsResult as any).AverageRating) || 0,
        totalRatings: (analyticsResult as any).TotalRatings || 0,
        ratingDistribution: JSON.parse((analyticsResult as any).RatingDistribution || '{}'),
        lastCalculated: (analyticsResult as any).LastCalculated
      };
    }

    return Response.json({
      success: true,
      data: {
        ratings,
        analytics
      }
    });

  } catch (error) {
    console.error('Error fetching blog post ratings:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create a new rating (requires signin)
// =============================================================================

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

    const body: CreateRatingRequest = await request.json();
    const { rating, review, raterName, language } = body;

    // Validate request body
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return Response.json(
        { success: false, error: 'Rating must be a number between 1 and 5' },
        { status: 400 }
      );
    }

    if (!raterName || typeof raterName !== 'string' || raterName.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Rater name is required' },
        { status: 400 }
      );
    }

    if (review && typeof review === 'string' && review.length > 2000) {
      return Response.json(
        { success: false, error: 'Review must be no more than 2,000 characters' },
        { status: 400 }
      );
    }

    if (language && !['en', 'es', 'fr', 'de', 'nl'].includes(language)) {
      return Response.json(
        { success: false, error: 'Invalid language' },
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

    // Check if user has already rated this post
    const existingRating = await db.prepare(`
      SELECT Id FROM ContentRatings 
      WHERE ContentId = ? AND ContentType = 'blog_post' AND RaterEmail = ?
    `).bind(postIdNum, session.user.email).first();

    if (existingRating) {
      return Response.json(
        { success: false, error: 'You have already rated this post' },
        { status: 409 }
      );
    }

    // Check if rater is a verified subscriber
    const isVerified = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM Subscribers 
      WHERE Email = ? AND Active = TRUE
    `).bind(session.user.email).first();
    
    const verified = (isVerified as any).count > 0;

    // Insert the rating
    const insertResult = await db.prepare(`
      INSERT INTO ContentRatings (
        ContentType, ContentId, RaterEmail, RaterName, Rating, Review, 
        Language, IsVerified, Status, CreatedAt, UpdatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      'blog_post',
      postIdNum,
      session.user.email,
      raterName.trim(),
      rating,
      review?.trim() || null,
      language || 'en',
      verified
    ).run();

    if (!insertResult.success) {
      console.error('Database error inserting rating:', insertResult.error);
      return Response.json(
        { success: false, error: 'Failed to create rating' },
        { status: 500 }
      );
    }

    const ratingId = insertResult.meta.last_row_id;

    // Update rating analytics
    await updateRatingAnalytics(db, postIdNum, 'blog_post');

    // Log the rating creation
    await logRatingAction(
      db,
      'content_rating_created',
      ratingId.toString(),
      session.user.email,
      {
        contentType: 'blog_post',
        contentId: postIdNum,
        rating,
        isVerified: verified,
        review: review?.trim(),
        language: language || 'en'
      },
      request
    );

    return Response.json({
      success: true,
      data: {
        id: ratingId,
        contentType: 'blog_post',
        contentId: postIdNum,
        raterEmail: session.user.email,
        raterName: raterName.trim(),
        rating,
        review: review?.trim(),
        language: language || 'en',
        isVerified: verified,
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating rating:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function updateRatingAnalytics(db: D1Database, contentId: number, contentType: string): Promise<void> {
  
  // Calculate new analytics
  const ratingsResult = await db.prepare(`
    SELECT Rating, COUNT(*) as count
    FROM ContentRatings 
    WHERE ContentId = ? AND ContentType = ? AND Status = 'approved'
    GROUP BY Rating
  `).bind(contentId, contentType).all();
  
  const ratings = ratingsResult.results as any[];
  
  if (ratings.length === 0) {
    return;
  }
  
  // Calculate average and distribution
  let totalRatings = 0;
  let totalScore = 0;
  const distribution: { [key: number]: number } = {};
  
  ratings.forEach(rating => {
    const count = rating.count;
    const score = rating.Rating;
    totalRatings += count;
    totalScore += score * count;
    distribution[score] = count;
  });
  
  const averageRating = totalRatings > 0 ? totalScore / totalRatings : 0;
  
  // Update or insert analytics
  await db.prepare(`
    INSERT OR REPLACE INTO RatingAnalytics (ContentType, ContentId, AverageRating, TotalRatings, RatingDistribution, LastCalculated)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    contentType,
    contentId,
    averageRating.toFixed(2),
    totalRatings,
    JSON.stringify(distribution)
  ).run();
}

// Rating Management API Route
// GET: List ratings for a blog post
// POST: Create a new rating

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { ContentRating, CreateRatingRequest, PaginationParams } from '@/types/subscriber-pages';
import { logRatingAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List ratings for a blog post
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
) {
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
  
  try {
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can view ratings on their own posts, admins can view any
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
    const status = searchParams.get('status') || 'approved';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Get ratings from database
    const { ratings, total, analytics } = await getBlogPostRatings(
      db,
      postId, 
      subscriberEmail,
      { page, limit, offset },
      { status, includeArchived }
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: ratings,
      analytics,
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
    console.error('Error fetching blog post ratings:', error);
    await logSubscriberPagesError(
      db,
      error as Error,
      'get_blog_post_ratings',
      session?.user?.email || 'unknown',
      { subscriberEmail, postId },
      request
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Create a new rating
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; postId: string }> }
) {
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
  
  try {
    
    if (isNaN(postId)) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can rate their own posts, admins can rate any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateRatingRequest = await request.json();
    
    // Validate request body
    const validation = validateCreateRatingRequest(body);
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

    // Check if user has already rated this post
    const existingRating = await getExistingRating(db, postId, session.user.email);
    if (existingRating) {
      return new Response(JSON.stringify({ 
        error: 'User has already rated this post',
        data: existingRating
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create rating
    const newRating = await createRating(db, postId, session.user.email, body);
    
    // Update rating analytics
    await updateRatingAnalytics(db, postId, 'blog_post');
    
    // Log the action
    await logRatingAction(
      db,
      'content_rating_created',
      newRating.Id.toString(),
      session.user.email,
      {
        contentType: 'blog_post',
        contentId: postId,
        rating: newRating.Rating,
        isVerified: newRating.IsVerified,
        review: newRating.Review,
        language: newRating.Language
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: newRating,
      message: 'Rating created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating rating:', error);
    await logSubscriberPagesError(
      db,
      error as Error,
      'create_rating',
      session?.user?.email || 'unknown',
      { subscriberEmail, postId, requestBody: await request.json() },
      request
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function getBlogPostRatings(
  db: D1Database,
  postId: number,
  subscriberEmail: string,
  pagination: PaginationParams,
  filters: { status: string; includeArchived: boolean }
): Promise<{ ratings: ContentRating[], total: number, analytics: any }> {
  
  // Build WHERE clause
  const whereConditions = ['cr.ContentId = ? AND cr.ContentType = "blog_post"'];
  const params: (string | number)[] = [postId];
  
  if (filters.status) {
    whereConditions.push('cr.Status = ?');
    params.push(filters.status);
  }
  
  if (!filters.includeArchived) {
    whereConditions.push('cr.Status != "archived"');
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM ContentRatings cr
    JOIN SubscriberBlogPosts sbp ON cr.ContentId = sbp.Id
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause} AND sh.SubscriberEmail = ?
  `;
  
  const countParams = [...params, subscriberEmail];
  const countResult = await db.prepare(countQuery).bind(...countParams).first();
  const total = (countResult as any).total;
  
  // Get ratings with pagination
  const ratingsQuery = `
    SELECT 
      cr.Id, cr.ContentType, cr.ContentId, cr.RaterEmail, cr.RaterName,
      cr.Rating, cr.Review, cr.Language, cr.IsVerified, cr.Status,
      cr.CreatedAt, cr.UpdatedAt
    FROM ContentRatings cr
    JOIN SubscriberBlogPosts sbp ON cr.ContentId = sbp.Id
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause} AND sh.SubscriberEmail = ?
    ORDER BY cr.CreatedAt DESC
    LIMIT ? OFFSET ?
  `;
  
  const ratingsParams = [...countParams, pagination.limit, pagination.offset];
  const ratingsResult = await db.prepare(ratingsQuery).bind(...ratingsParams).all();
  
  // Get analytics
  const analytics = await getRatingAnalytics(db, postId, 'blog_post');
  
  return {
    ratings: ratingsResult.results as unknown as ContentRating[],
    total,
    analytics
  };
}

async function createRating(db: D1Database, postId: number, raterEmail: string, data: CreateRatingRequest): Promise<ContentRating> {
  
  // Check if rater is a verified subscriber
  const isVerified = await checkRaterVerification(db, raterEmail);
  
  const result = await db.prepare(`
    INSERT INTO ContentRatings (ContentType, ContentId, RaterEmail, RaterName, Rating, Review, Language, IsVerified, Status)
    VALUES ('blog_post', ?, ?, ?, ?, ?, ?, ?, 'approved')
    RETURNING Id, ContentType, ContentId, RaterEmail, RaterName, Rating, Review, Language, IsVerified, Status, CreatedAt, UpdatedAt
  `).bind(
    postId,
    raterEmail,
    data.raterName,
    data.rating,
    data.review || null,
    data.language || 'en',
    isVerified
  ).first();
  
  return result as unknown as ContentRating;
}

async function getExistingRating(db: D1Database, postId: number, raterEmail: string): Promise<ContentRating | null> {
  
  const result = await db.prepare(`
    SELECT Id, ContentType, ContentId, RaterEmail, RaterName, Rating, Review, Language, IsVerified, Status, CreatedAt, UpdatedAt
    FROM ContentRatings 
    WHERE ContentId = ? AND ContentType = 'blog_post' AND RaterEmail = ?
  `).bind(postId, raterEmail).first();
  
  return result as unknown as ContentRating || null;
}

async function checkRaterVerification(db: D1Database, raterEmail: string): Promise<boolean> {
  
  // Check if user is a verified subscriber
  const result = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM Subscribers 
    WHERE Email = ? AND Active = TRUE
  `).bind(raterEmail).first();
  
  return (result as any).count > 0;
}

async function getRatingAnalytics(db: D1Database, contentId: number, contentType: string): Promise<any> {
  
  const result = await db.prepare(`
    SELECT AverageRating, TotalRatings, RatingDistribution, LastCalculated
    FROM RatingAnalytics 
    WHERE ContentId = ? AND ContentType = ?
  `).bind(contentId, contentType).first();
  
  if (result) {
    return {
      averageRating: (result as any).AverageRating,
      totalRatings: (result as any).TotalRatings,
      ratingDistribution: JSON.parse((result as any).RatingDistribution || '{}'),
      lastCalculated: (result as any).LastCalculated
    };
  }
  
  return {
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: {},
    lastCalculated: null
  };
}

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

function validateCreateRatingRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.rating || typeof data.rating !== 'number') {
    errors.push('Rating is required and must be a number');
  } else {
    if (data.rating < 1 || data.rating > 5) {
      errors.push('Rating must be between 1 and 5');
    }
  }
  
  if (!data.raterName || typeof data.raterName !== 'string') {
    errors.push('Rater name is required and must be a string');
  } else {
    const raterName = data.raterName.trim();
    
    if (raterName.length < 1) {
      errors.push('Rater name cannot be empty');
    }
    
    if (raterName.length > 100) {
      errors.push('Rater name must be no more than 100 characters long');
    }
  }
  
  if (data.review !== undefined && typeof data.review === 'string') {
    if (data.review.length > 2000) {
      errors.push('Review must be no more than 2,000 characters long');
    }
  }
  
  if (data.language !== undefined && typeof data.language === 'string') {
    const validLanguages = ['en', 'es', 'fr', 'de', 'nl'];
    if (!validLanguages.includes(data.language)) {
      errors.push('Language must be one of: en, es, fr, de, nl');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

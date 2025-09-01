// Public Blog API Route
// GET: List public blog posts for a handle
// POST: Create a new blog post (requires authentication)

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberBlogPost, CreateBlogPostRequest, PaginationParams, FilterParams } from '@/types/subscriber-pages';
import { logBlogPostAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List public blog posts for a handle
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const { handle } = await params;
    const handleName = decodeURIComponent(handle);
    
    // Get handle information
    const handleQuery = await db.prepare(`
      SELECT sh.*, sh.SubscriberEmail 
      FROM SubscriberHandles sh
      WHERE sh.Handle = ? AND sh.IsActive = 1 AND sh.IsPublic = 1
    `).bind(handleName).first();
    
    if (!handleQuery) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const subscriberEmail = handleQuery.SubscriberEmail as string;
    
    const { searchParams } = new URL(request.url);
    
    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Parse filter parameters
    const status = searchParams.get('status') || 'published';
    const language = searchParams.get('language');
    const search = searchParams.get('search');

    // Get public blog posts for this handle
    const { posts, total } = await getPublicBlogPosts(
      db,
      handleName,
      { page, limit, offset },
      { 
        status: status || undefined, 
        language: language || undefined, 
        search: search || undefined 
      }
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: posts,
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
    console.error('Error fetching public blog posts:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Create a new blog post (requires authentication)
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
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

    const { handle } = await params;
    const handleName = decodeURIComponent(handle);
    
    // Get handle information and verify ownership
    const handleQuery = await db.prepare(`
      SELECT sh.*, sh.SubscriberEmail 
      FROM SubscriberHandles sh
      WHERE sh.Handle = ? AND sh.IsActive = 1
    `).bind(handleName).first();
    
    if (!handleQuery) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const subscriberEmail = handleQuery.SubscriberEmail as string;
    
    // Check access: subscriber can create posts for their own handles, admins can create for any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateBlogPostRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.content || !body.handleId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify the handleId belongs to this handle
    const handleIdQuery = await db.prepare(`
      SELECT Id FROM SubscriberHandles 
      WHERE Id = ? AND Handle = ? AND SubscriberEmail = ?
    `).bind(body.handleId, handleName, subscriberEmail).first();
    
    if (!handleIdQuery) {
      return new Response(JSON.stringify({ error: 'Invalid handle ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the blog post
    const post = await createBlogPost(db, {
      ...body,
      subscriberEmail
    });
    
    // Log the action
    await logBlogPostAction(
      db,
      'blog_post_created',
      post.Id.toString(),
      subscriberEmail,
      {
        handleId: body.handleId.toString(),
        title: body.title,
        status: 'draft',
        language: body.language || 'en',
        tags: body.tags
      },
      request
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: post
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating blog post:', error);
    
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getPublicBlogPosts(
  db: D1Database,
  handle: string,
  pagination: PaginationParams,
  filters: FilterParams
): Promise<{ posts: SubscriberBlogPost[], total: number }> {
  const { page, limit, offset } = pagination;
  const { status, language, search } = filters;
  
  let whereConditions = ['sbp.HandleId = (SELECT Id FROM SubscriberHandles WHERE Handle = ? AND IsActive = 1)'];
  let params: (string | number)[] = [handle];
  
  // Add status filter (default to published for public API)
  if (status) {
    whereConditions.push('sbp.Status = ?');
    params.push(status);
  } else {
    whereConditions.push('sbp.Status = "published"');
  }
  
  // Add language filter
  if (language) {
    whereConditions.push('sbp.Language = ?');
    params.push(language);
  }
  
  // Add search filter
  if (search) {
    whereConditions.push('(sbp.Title LIKE ? OR sbp.Content LIKE ? OR sbp.Excerpt LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  // Get total count
  const countQuery = await db.prepare(`
    SELECT COUNT(*) as total
    FROM SubscriberBlogPosts sbp
    WHERE ${whereClause}
  `).bind(...params).first();
  
  const total = countQuery?.total as number || 0;
  
  // Get posts
  const postsQuery = await db.prepare(`
    SELECT 
      sbp.*,
      sh.Handle,
      sh.DisplayName as HandleDisplayName
    FROM SubscriberBlogPosts sbp
    JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
    WHERE ${whereClause}
    ORDER BY sbp.CreatedAt DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();
  
  const posts = postsQuery.results as unknown as SubscriberBlogPost[];
  
  // Get linked content for each blog post
  const postsWithLinkedContent = await Promise.all(
    posts.map(async (post) => {
      const linkedContentResult = await db.prepare(`
        SELECT 
          pc.Id, mf.FileName as Title, mf.Description, mf.MediaType, pc.AccessToken,
          pc.FormId, pc.GenreId, mf.Language, pc.PublishedAt,
          f.Name as FormName, g.Name as GenreName,
          pc.PublisherId
        FROM ContentLinks cl
        INNER JOIN PublishedContent pc ON cl.LinkedContentId = pc.Id
        INNER JOIN MediaFiles mf ON pc.MediaId = mf.Id
        LEFT JOIN Form f ON pc.FormId = f.Id
        LEFT JOIN Genre g ON pc.GenreId = g.Id
        WHERE cl.ContentType = 'blog_post' AND cl.ContentId = ?
        ORDER BY pc.PublishedAt DESC
      `).bind(post.Id).all();

      const linkedContent = linkedContentResult.results?.map((item: any) => ({
        id: item.Id as number,
        title: item.Title as string,
        description: item.Description as string | undefined,
        mediaType: item.MediaType as string,
        accessToken: item.AccessToken as string,
        form: item.FormName as string | undefined,
        genre: item.GenreName as string | undefined,
        language: item.Language as string | undefined,
        publisher: {
          email: item.PublisherId as string,
          name: item.PublisherId as string // Using email as name for now
        },
        publishedAt: item.PublishedAt as string
      })) || [];

      return {
        ...post,
        linkedContent
      };
    })
  );
  
  return { posts: postsWithLinkedContent, total };
}

async function createBlogPost(
  db: D1Database,
  data: CreateBlogPostRequest & { subscriberEmail: string }
): Promise<SubscriberBlogPost> {
  const { title, content, excerpt, language, tags, handleId, subscriberEmail } = data;
  
  const result = await db.prepare(`
    INSERT INTO SubscriberBlogPosts (
      SubscriberEmail, HandleId, Title, Content, Excerpt, Language, Tags, Status, CreatedAt, UpdatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
    RETURNING *
  `).bind(subscriberEmail, handleId, title, content, excerpt || null, language || 'en', tags || null).first();
  
  return result as unknown as SubscriberBlogPost;
}

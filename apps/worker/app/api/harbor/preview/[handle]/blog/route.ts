// Simplified Blog Preview API Route
// GET: Get internal preview of blog posts for a handle by name (doesn't require public status)

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberBlogPost } from '@/types/subscriber-pages';

// =============================================================================
// GET - Get internal preview of blog posts for a handle by name
// =============================================================================

export async function GET(
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
    
    // First, find the handle and its owner
    const handleQuery = await db.prepare(`
      SELECT SubscriberEmail FROM SubscriberHandles 
      WHERE Handle = ? AND IsActive = 1
    `).bind(handleName).first();
    
    if (!handleQuery) {
      return new Response(JSON.stringify({ error: 'Handle not found or not active' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const handleOwnerEmail = handleQuery.SubscriberEmail as string;
    
    // Check access: handle owner can preview their own handles, admins can preview any
    if (session.user.email !== handleOwnerEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, handleOwnerEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || 'published';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build status filter
    let statusFilter = '';
    if (status === 'published') {
      statusFilter = "AND sbp.Status = 'published'";
    } else if (status === 'draft') {
      statusFilter = "AND sbp.Status = 'draft'";
    } else if (status === 'archived') {
      statusFilter = "AND sbp.Status = 'archived'";
    }
    
    // Get blog posts for preview (only requires handle to be active, not public)
    const blogQuery = await db.prepare(`
      SELECT 
        sbp.Id,
        sbp.SubscriberEmail,
        sbp.HandleId,
        sbp.Title,
        sbp.Content,
        sbp.Excerpt,
        sbp.Language,
        sbp.Status,
        sbp.ViewCount,
        sbp.CreatedAt,
        sbp.UpdatedAt
      FROM SubscriberBlogPosts sbp
      JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sh.IsActive = 1
      ${statusFilter}
      ORDER BY sbp.CreatedAt DESC
      LIMIT ? OFFSET ?
    `).bind(handleName, limit, offset).all();
    
    // Get total count for pagination
    const countQuery = await db.prepare(`
      SELECT COUNT(*) as total
      FROM SubscriberBlogPosts sbp
      JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
      WHERE sh.Handle = ? AND sh.IsActive = 1
      ${statusFilter}
    `).bind(handleName).first();
    
    const totalPosts = (countQuery as any).total as number;
    const totalPages = Math.ceil(totalPosts / limit);
    
    // Transform results
    const blogPosts: SubscriberBlogPost[] = blogQuery.results.map((post: any) => ({
      Id: post.Id as number,
      SubscriberEmail: post.SubscriberEmail as string,
      HandleId: post.HandleId as number,
      Title: post.Title as string,
      Content: post.Content as string,
      Excerpt: post.Excerpt as string || undefined,
      Language: post.Language as string,
      Status: post.Status as 'archived' | 'draft' | 'published',
      ViewCount: post.ViewCount as number,
      CreatedAt: post.CreatedAt as string,
      UpdatedAt: post.UpdatedAt as string
    }));
    
    return new Response(JSON.stringify({
      success: true,
      data: blogPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        limit
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching blog preview:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

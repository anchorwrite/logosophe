// Simplified Handle Preview API Route
// GET: Get internal preview information about a handle by name (doesn't require public status)

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberHandle } from '@/types/subscriber-pages';

// =============================================================================
// GET - Get internal handle preview information by handle name
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
      SELECT 
        sh.Id,
        sh.Handle,
        sh.DisplayName,
        sh.Description,
        sh.IsActive,
        sh.IsPublic,
        sh.CreatedAt,
        sh.SubscriberEmail
      FROM SubscriberHandles sh
      WHERE sh.Handle = ? AND sh.IsActive = 1
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
    
    // Return handle information for preview
    const previewHandleInfo: SubscriberHandle = {
      Id: handleQuery.Id as number,
      SubscriberEmail: handleQuery.SubscriberEmail as string,
      Handle: handleQuery.Handle as string,
      DisplayName: handleQuery.DisplayName as string,
      Description: handleQuery.Description as string || undefined,
      IsActive: Boolean(handleQuery.IsActive),
      IsPublic: Boolean(handleQuery.IsPublic),
      CreatedAt: handleQuery.CreatedAt as string,
      UpdatedAt: handleQuery.CreatedAt as string // Use CreatedAt as fallback
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: previewHandleInfo
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching handle preview:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

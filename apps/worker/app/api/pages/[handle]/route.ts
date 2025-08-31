// Public Handle Information API Route
// GET: Get public information about a handle

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SubscriberHandle } from '@/types/subscriber-pages';

// Public handle interface (without sensitive information)
interface PublicHandleInfo {
  Id: number;
  Handle: string;
  DisplayName: string;
  Description?: string;
  IsActive: boolean;
  IsPublic: boolean;
  CreatedAt: string;
}

// =============================================================================
// GET - Get public handle information
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
    
    // Get public handle information
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
      WHERE sh.Handle = ? AND sh.IsActive = 1 AND sh.IsPublic = 1
    `).bind(handleName).first();
    
    if (!handleQuery) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Remove sensitive information before returning
    const publicHandleInfo: PublicHandleInfo = {
      Id: handleQuery.Id as number,
      Handle: handleQuery.Handle as string,
      DisplayName: handleQuery.DisplayName as string,
      Description: handleQuery.Description as string || undefined,
      IsActive: Boolean(handleQuery.IsActive),
      IsPublic: Boolean(handleQuery.IsPublic),
      CreatedAt: handleQuery.CreatedAt as string
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: publicHandleInfo
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching handle information:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

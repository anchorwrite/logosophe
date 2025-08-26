// Individual Handle Management API Route
// GET: Get specific handle details
// PUT: Update handle status and properties
// PATCH: Partial update for status changes

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberHandle, UpdateHandleRequest } from '@/types/subscriber-pages';
import { logHandleAction } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - Get specific handle details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; handleId: string }> }
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

    const { email, handleId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const handleIdNum = parseInt(handleId);
    
    if (isNaN(handleIdNum)) {
      return new Response(JSON.stringify({ error: 'Invalid handle ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can view their own handles, admins can view any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get handle from database
    const handle = await getHandleById(db, handleIdNum, subscriberEmail);
    
    if (!handle) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: handle
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching handle:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// PUT - Update handle status and properties
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; handleId: string }> }
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

    const { email, handleId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const handleIdNum = parseInt(handleId);
    
    if (isNaN(handleIdNum)) {
      return new Response(JSON.stringify({ error: 'Invalid handle ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can update their own handles, admins can update any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify handle exists and belongs to this subscriber
    const existingHandle = await getHandleById(db, handleIdNum, subscriberEmail);
    
    if (!existingHandle) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: UpdateHandleRequest = await request.json();
    
    // Validate required fields
    if (body.isActive === undefined && body.isPublic === undefined) {
      return new Response(JSON.stringify({ error: 'At least one field must be provided for update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the handle
    const updateResult = await db.prepare(`
      UPDATE SubscriberHandles 
      SET 
        IsActive = COALESCE(?, IsActive),
        IsPublic = COALESCE(?, IsPublic),
        UpdatedAt = datetime('now')
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : null,
      body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : null,
      handleIdNum,
      subscriberEmail
    ).run();
    
    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to update handle' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get updated handle
    const updatedHandle = await getHandleById(db, handleIdNum, subscriberEmail);
    
    // Log the action
    await logHandleAction(
      db,
      'subscriber_handle_updated',
      handleIdNum.toString(),
      subscriberEmail,
      {
        handleId: handleIdNum,
        handle: existingHandle.Handle,
        displayName: existingHandle.DisplayName,
        isActive: body.isActive,
        isPublic: body.isPublic,
        previousStatus: {
          isActive: existingHandle.IsActive,
          isPublic: existingHandle.IsPublic
        }
      },
      request
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: updatedHandle,
      message: 'Handle updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating handle:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// PATCH - Partial update for status changes
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; handleId: string }> }
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

    const { email, handleId } = await params;
    const subscriberEmail = decodeURIComponent(email);
    const handleIdNum = parseInt(handleId);
    
    if (isNaN(handleIdNum)) {
      return new Response(JSON.stringify({ error: 'Invalid handle ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check access: subscriber can update their own handles, admins can update any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify handle exists and belongs to this subscriber
    const existingHandle = await getHandleById(db, handleIdNum, subscriberEmail);
    
    if (!existingHandle) {
      return new Response(JSON.stringify({ error: 'Handle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: UpdateHandleRequest = await request.json();
    
    // Validate required fields
    if (body.isActive === undefined && body.isPublic === undefined) {
      return new Response(JSON.stringify({ error: 'At least one field must be provided for update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the handle
    const updateResult = await db.prepare(`
      UPDATE SubscriberHandles 
      SET 
        IsActive = COALESCE(?, IsActive),
        IsPublic = COALESCE(?, IsPublic),
        UpdatedAt = datetime('now')
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : null,
      body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : null,
      handleIdNum,
      subscriberEmail
    ).run();
    
    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Failed to update handle' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get updated handle
    const updatedHandle = await getHandleById(db, handleIdNum, subscriberEmail);
    
    // Log the action
    await logHandleAction(
      db,
      'subscriber_handle_updated',
      handleIdNum.toString(),
      subscriberEmail,
      {
        handleId: handleIdNum,
        handle: existingHandle.Handle,
        displayName: existingHandle.DisplayName,
        isActive: body.isActive,
        isPublic: body.isPublic,
        previousStatus: {
          isActive: existingHandle.IsActive,
          isPublic: existingHandle.IsPublic
        }
      },
      request
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: updatedHandle,
      message: 'Handle updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating handle:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getHandleById(db: D1Database, handleId: number, subscriberEmail: string): Promise<SubscriberHandle | null> {
  const result = await db.prepare(`
    SELECT 
      Id, SubscriberEmail, Handle, DisplayName, Description, 
      IsActive, IsPublic, CreatedAt, UpdatedAt
    FROM SubscriberHandles 
    WHERE Id = ? AND SubscriberEmail = ?
  `).bind(handleId, subscriberEmail).first();
  
  if (!result) return null;
  
  return {
    Id: result.Id as number,
    SubscriberEmail: result.SubscriberEmail as string,
    Handle: result.Handle as string,
    DisplayName: result.DisplayName as string,
    Description: result.Description as string || undefined,
    IsActive: Boolean(result.IsActive),
    IsPublic: Boolean(result.IsPublic),
    CreatedAt: result.CreatedAt as string,
    UpdatedAt: result.UpdatedAt as string
  };
}

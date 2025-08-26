// Handle Management API Route
// GET: List handles for a subscriber
// POST: Create a new handle

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SubscriberHandle, CreateHandleRequest, HandleValidationResponse } from '@/types/subscriber-pages';
import { logHandleAction, logHandleLimitAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - List handles for a subscriber
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
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

    const { email } = await params;
    const subscriberEmail = decodeURIComponent(email);
    
    // Check access: subscriber can view their own handles, admins can view any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Get handles from database
    const handles = await getSubscriberHandles(db, subscriberEmail, includeInactive);
    
    // Get handle limit for subscriber
    const handleLimit = await getSubscriberHandleLimit(db, subscriberEmail);
    
    return new Response(JSON.stringify({
      success: true,
      data: handles,
      handleLimit
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching subscriber handles:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Create a new handle
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
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

    const { email } = await params;
    const subscriberEmail = decodeURIComponent(email);
    
    // Check access: subscriber can create their own handles, admins can create for any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateHandleRequest = await request.json();
    
    // Validate request body
    const validation = validateCreateHandleRequest(body);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request', 
        details: validation.errors 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check handle limit
    const handleLimit = await getSubscriberHandleLimit(db, subscriberEmail);
    const currentHandles = await getSubscriberHandles(db, subscriberEmail, false);
    
    if (currentHandles.length >= handleLimit.MaxHandles) {
      await logHandleLimitAction(
        db,
        'handle_limit_checked',
        subscriberEmail,
        {
          currentLimit: handleLimit.MaxHandles,
          currentCount: currentHandles.length,
          requestedAction: 'create_handle'
        },
        request
      );
      
      return new Response(JSON.stringify({ 
        error: 'Handle limit exceeded',
        details: {
          currentLimit: handleLimit.MaxHandles,
          currentCount: currentHandles.length,
          limitType: handleLimit.LimitType
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate handle uniqueness
    const handleValidation = await validateHandleUniqueness(db, body.handle);
    if (!handleValidation.isValid) {
      return new Response(JSON.stringify({ 
        error: 'Handle validation failed', 
        details: handleValidation.errors,
        suggestions: handleValidation.suggestions
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create handle
    const newHandle = await createSubscriberHandle(db, subscriberEmail, body);
    
    // Log the action
    await logHandleAction(
      db,
      'subscriber_handle_created',
      newHandle.Id.toString(),
      subscriberEmail,
      {
        handle: newHandle.Handle,
        displayName: newHandle.DisplayName,
        description: newHandle.Description,
        isActive: newHandle.IsActive,
        isPublic: newHandle.IsPublic
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: newHandle,
      message: 'Handle created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating subscriber handle:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function getSubscriberHandles(db: D1Database, subscriberEmail: string, includeInactive: boolean = false): Promise<SubscriberHandle[]> {
  
  let query = `
    SELECT Id, SubscriberEmail, Handle, DisplayName, Description, IsActive, IsPublic, CreatedAt, UpdatedAt
    FROM SubscriberHandles 
    WHERE SubscriberEmail = ?
  `;
  
  const params = [subscriberEmail];
  
  if (!includeInactive) {
    query += ' AND IsActive = TRUE';
  }
  
  query += ' ORDER BY CreatedAt DESC';
  
  const result = await db.prepare(query).bind(...params).all();
  return result.results as unknown as SubscriberHandle[];
}

async function getSubscriberHandleLimit(db: D1Database, subscriberEmail: string) {
  
  // For now, return default limit. In the future, this could be based on subscriber tier
  const result = await db.prepare(`
    SELECT Id, LimitType, MaxHandles, Description, IsActive
    FROM SubscriberHandleLimits 
    WHERE LimitType = 'default' AND IsActive = TRUE
  `).first();
  
  return result as any;
}

async function createSubscriberHandle(db: D1Database, subscriberEmail: string, data: CreateHandleRequest): Promise<SubscriberHandle> {
  
  const result = await db.prepare(`
    INSERT INTO SubscriberHandles (SubscriberEmail, Handle, DisplayName, Description, IsActive, IsPublic)
    VALUES (?, ?, ?, ?, TRUE, FALSE)
    RETURNING Id, SubscriberEmail, Handle, DisplayName, Description, IsActive, IsPublic, CreatedAt, UpdatedAt
  `).bind(
    subscriberEmail,
    data.handle.toLowerCase(),
    data.displayName,
    data.description || null
  ).first();
  
  return result as unknown as SubscriberHandle;
}

async function validateHandleUniqueness(db: D1Database, handle: string): Promise<HandleValidationResponse> {
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM SubscriberHandles WHERE Handle = ?
  `).bind(handle.toLowerCase()).first();
  
  const exists = (result as any).count > 0;
  
  if (exists) {
    // Generate suggestions
    const suggestions = await generateHandleSuggestions(handle);
    
    return {
      isValid: false,
      errors: ['Handle already exists'],
      suggestions
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}

async function generateHandleSuggestions(baseHandle: string): Promise<string[]> {
  const suggestions: string[] = [];
  
  // Add numbers
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${baseHandle}${i}`);
  }
  
  // Add common suffixes
  const suffixes = ['official', 'real', 'official', 'verified', 'pro'];
  for (const suffix of suffixes) {
    suggestions.push(`${baseHandle}-${suffix}`);
  }
  
  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateCreateHandleRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.handle || typeof data.handle !== 'string') {
    errors.push('Handle is required and must be a string');
  } else {
    const handle = data.handle.trim();
    
    if (handle.length < 3) {
      errors.push('Handle must be at least 3 characters long');
    }
    
    if (handle.length > 30) {
      errors.push('Handle must be no more than 30 characters long');
    }
    
    if (!/^[a-zA-Z0-9-]+$/.test(handle)) {
      errors.push('Handle can only contain letters, numbers, and hyphens');
    }
    
    if (handle.startsWith('-') || handle.endsWith('-')) {
      errors.push('Handle cannot start or end with a hyphen');
    }
    
    if (handle.includes('--')) {
      errors.push('Handle cannot contain consecutive hyphens');
    }
  }
  
  if (!data.displayName || typeof data.displayName !== 'string') {
    errors.push('Display name is required and must be a string');
  } else {
    const displayName = data.displayName.trim();
    
    if (displayName.length < 1) {
      errors.push('Display name cannot be empty');
    }
    
    if (displayName.length > 100) {
      errors.push('Display name must be no more than 100 characters long');
    }
  }
  
  if (data.description && typeof data.description === 'string') {
    if (data.description.length > 500) {
      errors.push('Description must be no more than 500 characters long');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

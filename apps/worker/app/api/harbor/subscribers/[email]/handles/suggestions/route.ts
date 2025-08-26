// Handle Suggestions API Route
// GET: Get handle suggestions for a subscriber
// POST: Validate a handle and get suggestions

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { HandleSuggestionRequest, HandleValidationResponse } from '@/types/subscriber-pages';
import { logHandleSuggestionAction, logSubscriberPagesError } from '@/lib/subscriber-pages-logging';

// =============================================================================
// GET - Get handle suggestions for a subscriber
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
    
    // Check access: subscriber can get their own suggestions, admins can get for any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const baseName = searchParams.get('baseName') || searchParams.get('handle');
    const suggestionType = searchParams.get('suggestionType') || 'auto';

    if (!baseName) {
      return new Response(JSON.stringify({ 
        error: 'baseName or handle parameter is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that we received a non-empty string
    if (baseName.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Handle parameter cannot be empty' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate the handle
    const validation = await validateHandle(db, baseName);
    
    // Generate suggestions
    const suggestions = await generateHandleSuggestions(baseName, suggestionType as any);
    
    // Store suggestions in database for tracking
    await storeHandleSuggestions(db, subscriberEmail, baseName, suggestions, suggestionType as any);

    return new Response(JSON.stringify({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        suggestions: suggestions
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating handle suggestions:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// POST - Validate a handle and get suggestions
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
    
    // Check access: subscriber can validate their own handles, admins can validate for any
    if (session.user.email !== subscriberEmail && 
        !(await isSystemAdmin(session.user.email, db)) && 
        !(await isTenantAdminFor(session.user.email, subscriberEmail))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: HandleSuggestionRequest = await request.json();
    
    if (!body.baseName) {
      return new Response(JSON.stringify({ 
        error: 'baseName is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate the handle
    const validation = await validateHandle(db, body.baseName);
    
    // Generate suggestions if validation fails
    let suggestions: string[] = [];
    if (!validation.isValid) {
      suggestions = await generateHandleSuggestions(
        body.baseName, 
        body.suggestionType || 'auto'
      );
      
      // Store suggestions in database
      await storeHandleSuggestions(
        db,
        subscriberEmail, 
        body.baseName, 
        suggestions, 
        body.suggestionType || 'auto'
      );
    }

    // Log the validation action
    await logHandleSuggestionAction(
      db,
      'handle_suggestion_generated',
      subscriberEmail,
      {
        baseName: body.baseName,
        suggestedHandle: body.baseName,
        suggestionType: body.suggestionType || 'auto',
        isValid: validation.isValid,
        suggestionsCount: suggestions.length
      },
      request
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...validation,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        baseName: body.baseName
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error validating handle:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function storeHandleSuggestions(
  db: D1Database,
  subscriberEmail: string, 
  baseName: string, 
  suggestions: string[], 
  suggestionType: 'auto' | 'user_request' | 'system_generated'
) {
  
  // Store each suggestion
  for (const suggestion of suggestions) {
    await db.prepare(`
      INSERT OR IGNORE INTO HandleSuggestions (SubscriberEmail, SuggestedHandle, BaseName, SuggestionType)
      VALUES (?, ?, ?, ?)
    `).bind(subscriberEmail, suggestion, baseName, suggestionType).run();
  }
}

async function validateHandle(db: D1Database, handle: string): Promise<HandleValidationResponse> {
  
  const errors: string[] = [];
  
  // Basic validation
  if (!handle || typeof handle !== 'string') {
    errors.push('Handle is required and must be a string');
    return { isValid: false, errors };
  }
  
  const trimmedHandle = handle.trim();
  
  if (trimmedHandle.length < 3) {
    errors.push(`Handle must be at least 3 characters long (received: "${trimmedHandle}" with length ${trimmedHandle.length})`);
  }
  
  if (trimmedHandle.length > 30) {
    errors.push('Handle must be no more than 30 characters long');
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(trimmedHandle)) {
    errors.push('Handle can only contain letters, numbers, and hyphens');
  }
  
  if (trimmedHandle.startsWith('-') || trimmedHandle.endsWith('-')) {
    errors.push('Handle cannot start or end with a hyphen');
  }
  
  if (trimmedHandle.includes('--')) {
    errors.push('Handle cannot contain consecutive hyphens');
  }
  
  // Check for reserved words
  const reservedWords = [
    'admin', 'administrator', 'api', 'app', 'apps', 'blog', 'cdn', 'docs', 
    'help', 'login', 'logout', 'mail', 'news', 'search', 'shop', 'store',
    'support', 'www', 'www1', 'www2', 'mail1', 'mail2', 'ftp', 'smtp',
    'pop', 'imap', 'webmail', 'email', 'test', 'dev', 'staging', 'prod'
  ];
  
  if (reservedWords.includes(trimmedHandle.toLowerCase())) {
    errors.push('Handle contains a reserved word');
  }
  
  // Check uniqueness in database
  if (errors.length === 0) {
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM SubscriberHandles WHERE Handle = ?
    `).bind(trimmedHandle.toLowerCase()).first();
    
    const exists = (result as any).count > 0;
    
    if (exists) {
      errors.push('Handle already exists');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

async function generateHandleSuggestions(
  baseName: string, 
  suggestionType: 'auto' | 'user_request' | 'system_generated'
): Promise<string[]> {
  const suggestions: string[] = [];
  const cleanBaseName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Add numbers
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${cleanBaseName}${i}`);
  }
  
  // Add common suffixes
  const suffixes = ['official', 'real', 'verified', 'pro', 'original', 'main'];
  for (const suffix of suffixes) {
    suggestions.push(`${cleanBaseName}-${suffix}`);
  }
  
  // Add creative variations
  const variations = ['the', 'my', 'official', 'real'];
  for (const variation of variations) {
    suggestions.push(`${variation}-${cleanBaseName}`);
  }
  
  // Add year suffixes
  const currentYear = new Date().getFullYear();
  suggestions.push(`${cleanBaseName}${currentYear}`);
  suggestions.push(`${cleanBaseName}-${currentYear}`);
  
  // Add random numbers
  for (let i = 0; i < 3; i++) {
    const randomNum = Math.floor(Math.random() * 1000);
    suggestions.push(`${cleanBaseName}${randomNum}`);
  }
  
  // Filter out duplicates and limit length
  const uniqueSuggestions = [...new Set(suggestions)].filter(s => s.length <= 30);
  
  return uniqueSuggestions.slice(0, 15); // Return top 15 suggestions
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sanitizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '') // Remove invalid characters
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

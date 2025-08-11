import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

// Simple link validation function
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Basic link preview data (in a real implementation, you'd fetch this from external services)
async function getLinkPreview(url: string): Promise<{
  title?: string;
  description?: string;
  thumbnailUrl?: string;
}> {
  try {
    // For now, return basic metadata
    // In production, you'd implement:
    // 1. Fetch the URL
    // 2. Parse HTML for meta tags
    // 3. Extract title, description, and thumbnail
    // 4. Cache results to avoid repeated fetches
    
    return {
      title: extractDomain(url),
      description: `Link to ${extractDomain(url)}`,
      thumbnailUrl: undefined
    };
  } catch (error) {
    console.error('Link preview error:', error);
    return {
      title: extractDomain(url),
      description: 'Unable to generate preview',
      thumbnailUrl: undefined
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userEmail = session.user.email;
    const body = await request.json() as { url: string; tenantId: string };
    
    const { url, tenantId } = body;
    
    // Validate required fields
    if (!url || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: url, tenantId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this tenant
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, tenantId)) {
        hasAccess = true;
      } else {
        // Check if user is a member of this tenant
        const userTenant = await db.prepare(`
          SELECT 1 FROM TenantUsers 
          WHERE TenantId = ? AND Email = ?
        `).bind(tenantId, userEmail).first();
        
        hasAccess = !!userTenant;
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: User does not have access to this tenant' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid URL format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic security check - prevent common malicious URLs
    const domain = extractDomain(url);
    const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedDomains.includes(domain)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'URL not allowed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get link preview
    const preview = await getLinkPreview(url);

    return new Response(JSON.stringify({
      success: true,
      url,
      domain,
      title: preview.title,
      description: preview.description,
      thumbnailUrl: preview.thumbnailUrl,
      isValid: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Link processing error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { url } = await request.json() as { url: string };

    if (!url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing URL' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid URL format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic security check - only allow HTTP/HTTPS URLs
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Only HTTP and HTTPS URLs are allowed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract basic metadata
    const domain = parsedUrl.hostname;
    const path = parsedUrl.pathname;
    
    // Basic link preview data
    const linkPreview = {
      url: url,
      domain: domain,
      title: domain, // Default to domain name
      description: `Link to ${domain}`,
      thumbnailUrl: null as string | null,
      isValid: true
    };

    // Try to fetch basic metadata (this is a simplified version)
    // In production, you might want to use a service like OpenGraph.io or similar
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Logosophe-Messaging/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        const html = await response.text();
        
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          linkPreview.title = titleMatch[1].trim();
        }

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (descMatch) {
          linkPreview.description = descMatch[1].trim();
        }

        // Extract Open Graph title
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (ogTitleMatch) {
          linkPreview.title = ogTitleMatch[1].trim();
        }

        // Extract Open Graph description
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (ogDescMatch) {
          linkPreview.description = ogDescMatch[1].trim();
        }

        // Extract Open Graph image
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogImageMatch) {
          linkPreview.thumbnailUrl = ogImageMatch[1].trim();
        }

        // Extract Twitter Card image
        const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
        if (twitterImageMatch && !linkPreview.thumbnailUrl) {
          linkPreview.thumbnailUrl = twitterImageMatch[1].trim();
        }

      }
    } catch (error) {
      // If fetching fails, we still return basic metadata
      console.warn('Failed to fetch link metadata:', error);
      linkPreview.description = `Link to ${domain} (metadata unavailable)`;
    }

    // Clean up description if it's too long
    if (linkPreview.description && linkPreview.description.length > 200) {
      linkPreview.description = linkPreview.description.substring(0, 197) + '...';
    }

    return new Response(JSON.stringify({
      success: true,
      data: linkPreview
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing link:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

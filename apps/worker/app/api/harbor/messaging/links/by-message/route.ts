import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
// Removed messaging events import - no longer needed

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

export async function GET(
  request: NextRequest
) {
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
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const tenantId = searchParams.get('tenantId');

    if (!messageId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing messageId parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing tenantId parameter' 
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

    // Verify message exists and user has access to it
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail 
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.Id = ? AND m.TenantId = ? AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    `).bind(messageId, tenantId, userEmail, userEmail).first();

    if (!message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found or access denied' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get links for this message
    const links = await db.prepare(`
      SELECT 
        ml.Id,
        ml.MessageId,
        ml.Url,
        ml.Title,
        ml.Description,
        ml.ThumbnailUrl,
        ml.Domain,
        ml.CreatedAt
      FROM MessageLinks ml
      WHERE ml.MessageId = ?
      ORDER BY ml.CreatedAt ASC
    `).bind(messageId).all();

    // Format links for response
    const formattedLinks = links.results?.map(link => ({
      id: link.Id,
      messageId: link.MessageId,
      url: link.Url,
      title: link.Title,
      description: link.Description,
      thumbnailUrl: link.ThumbnailUrl,
      domain: link.Domain,
      createdAt: link.CreatedAt
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      links: formattedLinks,
      totalCount: formattedLinks.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get links error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(
  request: NextRequest
) {
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
    const body = await request.json() as { messageId: string; url: string; title?: string; description?: string; thumbnailUrl?: string; tenantId: string };
    
    const { messageId, url, title, description, thumbnailUrl, tenantId } = body;
    
    // Validate required fields
    if (!messageId || !url || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, url, tenantId' 
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

    // Verify message exists and user has access to it
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail 
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.Id = ? AND m.TenantId = ? AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    `).bind(messageId, tenantId, userEmail, userEmail).first();

    if (!message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found or access denied' 
      }), {
        status: 404,
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

    // Check if link already exists
    const existingLink = await db.prepare(`
      SELECT 1 FROM MessageLinks 
      WHERE MessageId = ? AND Url = ?
    `).bind(messageId, url).first();

    if (existingLink) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Link is already added to this message' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create message link record
    const linkResult = await db.prepare(`
      INSERT INTO MessageLinks (MessageId, Url, Title, Description, ThumbnailUrl, Domain, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      messageId,
      url,
      title || domain,
      description || `Link to ${domain}`,
      thumbnailUrl || null,
      domain
    ).run();

    const linkId = linkResult.meta.last_row_id;

    // Update message to reflect link status
    await db.prepare(`
      UPDATE Messages 
      SET HasLinks = TRUE, LinkCount = (
        SELECT COUNT(*) FROM MessageLinks WHERE MessageId = ?
      )
      WHERE Id = ?
    `).bind(messageId, messageId).run();

    // SSE events are now handled by the polling-based endpoint
    // No need to broadcast - clients will receive updates automatically

    return new Response(JSON.stringify({
      success: true,
      linkId,
      url,
      title: title || domain,
      description: description || `Link to ${domain}`,
      thumbnailUrl,
      domain
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add link error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(
  request: NextRequest
) {
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
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const tenantId = searchParams.get('tenantId');
    const linkId = searchParams.get('linkId');

    if (!messageId || !tenantId || !linkId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required parameters: messageId, tenantId, linkId' 
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

    // Get link details and verify access
    const link = await db.prepare(`
      SELECT ml.*, m.TenantId, m.SenderEmail, mr.RecipientEmail
      FROM MessageLinks ml
      INNER JOIN Messages m ON ml.MessageId = m.Id
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE ml.Id = ? AND m.TenantId = ?
    `).bind(linkId, tenantId).first();

    if (!link) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Link not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this message (sender or recipient)
    if (link.SenderEmail !== userEmail && link.RecipientEmail !== userEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You can only remove links from messages you sent or received' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store link details for event broadcasting
    const linkDetails = {
      messageId: parseInt(link.MessageId as string),
      tenantId: link.TenantId as string,
      linkId: parseInt(linkId),
      url: link.Url as string,
      title: link.Title as string,
      description: link.Description as string,
      thumbnailUrl: link.ThumbnailUrl as string,
      domain: link.Domain as string
    };

    // Delete the link
    await db.prepare(`
      DELETE FROM MessageLinks WHERE Id = ?
    `).bind(linkId).run();

    // Update message to reflect link status
    await db.prepare(`
      UPDATE Messages 
      SET HasLinks = (
        SELECT COUNT(*) > 0 FROM MessageLinks WHERE MessageId = ?
      ), LinkCount = (
        SELECT COUNT(*) FROM MessageLinks WHERE MessageId = ?
      )
      WHERE Id = ?
    `).bind(link.MessageId, link.MessageId, link.MessageId).run();

    // SSE events are now handled by the polling-based endpoint
    // No need to broadcast - clients will receive updates automatically

    return new Response(JSON.stringify({
      success: true,
      message: 'Link removed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Remove link error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

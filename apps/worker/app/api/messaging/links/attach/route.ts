import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createLinkEventData } from '@/lib/messaging-events';

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
    const body = await request.json() as { messageId: string; url: string; title?: string; description?: string; thumbnailUrl?: string; tenantId: string };
    
    const { messageId, url, title, description, thumbnailUrl, tenantId } = body;

    if (!messageId || !url || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, url, tenantId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid URL format' 
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

    // Verify the message exists and user has access to it
    const message = await db.prepare(`
      SELECT Id, SenderEmail, TenantId FROM Messages WHERE Id = ?
    `).bind(messageId).first();

    if (!message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is the sender or has access to the message
    if (message.SenderEmail !== userEmail && message.TenantId !== tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You can only attach links to your own messages' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if link is already attached to this message
    const existingLink = await db.prepare(`
      SELECT Id FROM MessageLinks WHERE MessageId = ? AND Url = ?
    `).bind(messageId, url).first();

    if (existingLink) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Link is already attached to this message' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract domain from URL
    const domain = new URL(url).hostname;

    // Add the link
    const linkResult = await db.prepare(`
      INSERT INTO MessageLinks (MessageId, Url, Title, Description, ThumbnailUrl, Domain)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      url,
      title || null,
      description || null,
      thumbnailUrl || null,
      domain
    ).run();

    const linkId = linkResult.meta.last_row_id;

    // Broadcast SSE event for link added
    const eventData = createLinkEventData(
      parseInt(messageId),
      tenantId,
      linkId,
      url,
      title,
      domain
    );

    MessagingEventBroadcaster.broadcastLinkAdded(tenantId, eventData);

    return new Response(JSON.stringify({
      success: true,
      data: {
        linkId,
        url,
        title,
        description,
        thumbnailUrl,
        domain,
        messageId: parseInt(messageId)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error attaching link:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

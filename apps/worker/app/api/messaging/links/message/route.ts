import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function GET(request: NextRequest) {
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
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing messageId parameter' 
      }), {
        status: 400,
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

    // Check if user has access to this message
    let hasAccess = false;
    
    // System admins have access to all messages
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is the sender
      if (message.SenderEmail === userEmail) {
        hasAccess = true;
      } else {
        // Check if user is a tenant admin for this tenant
        if (await isTenantAdminFor(userEmail, message.TenantId as string)) {
          hasAccess = true;
        } else {
          // Check if user is a recipient of this message
          const recipient = await db.prepare(`
            SELECT 1 FROM MessageRecipients WHERE MessageId = ? AND RecipientEmail = ?
          `).bind(messageId, userEmail).first();
          
          hasAccess = !!recipient;
        }
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You do not have access to this message' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get links for this message
    const links = await db.prepare(`
      SELECT 
        Id,
        MessageId,
        Url,
        Title,
        Description,
        ThumbnailUrl,
        Domain,
        CreatedAt
      FROM MessageLinks
      WHERE MessageId = ?
      ORDER BY CreatedAt ASC
    `).bind(messageId).all();

    // Transform the data to match the expected format
    const transformedLinks = links.results.map((link: any) => ({
      id: link.Id,
      messageId: link.MessageId,
      url: link.Url,
      title: link.Title,
      description: link.Description,
      thumbnailUrl: link.ThumbnailUrl,
      domain: link.Domain,
      createdAt: link.CreatedAt
    }));

    return new Response(JSON.stringify({ 
      success: true, 
      links: transformedLinks 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching message links:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

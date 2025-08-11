import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createLinkEventData } from '@/lib/messaging-events';

export async function DELETE(request: NextRequest) {
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
    const linkId = url.searchParams.get('linkId');

    if (!linkId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing linkId parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get link details to check access
    const link = await db.prepare(`
      SELECT 
        ml.Id,
        ml.MessageId,
        ml.Url,
        ml.Title,
        ml.Domain,
        m.SenderEmail,
        m.TenantId
      FROM MessageLinks ml
      JOIN Messages m ON ml.MessageId = m.Id
      WHERE ml.Id = ?
    `).bind(linkId).first();

    if (!link) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Link not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has permission to delete this link
    let hasPermission = false;
    
    // System admins can delete any link
    if (await isSystemAdmin(userEmail, db)) {
      hasPermission = true;
    } else {
      // Check if user is the sender of the message
      if (link.SenderEmail === userEmail) {
        hasPermission = true;
      } else {
        // Check if user is a tenant admin for this tenant
        if (await isTenantAdminFor(userEmail, link.TenantId as string)) {
          hasPermission = true;
        }
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You do not have permission to delete this link' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the link
    await db.prepare(`
      DELETE FROM MessageLinks WHERE Id = ?
    `).bind(linkId).run();

    // Broadcast link removed event
    try {
      const eventData = createLinkEventData(
        parseInt(link.MessageId as string),
        link.TenantId as string,
        parseInt(linkId),
        link.Url as string,
        link.Title as string,
        link.Domain as string
      );
      
      MessagingEventBroadcaster.broadcastLinkRemoved(link.TenantId as string, eventData);
    } catch (broadcastError) {
      console.error('Failed to broadcast link removal event:', broadcastError);
      // Don't fail the request if broadcasting fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Link deleted successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting link:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

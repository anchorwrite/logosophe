import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const r2 = context.env.MEDIA_BUCKET;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userEmail = session.user.email;
    const { id } = await params;
    const attachmentId = parseInt(id);

    if (isNaN(attachmentId)) {
      return new Response('Invalid attachment ID', { status: 400 });
    }

    // Get attachment details and verify user has access to the message
    const attachmentQuery = `
      SELECT ma.*, m.TenantId
      FROM MessageAttachments ma
      INNER JOIN Messages m ON ma.MessageId = m.Id
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE ma.Id = ? AND (mr.RecipientEmail = ? OR m.SenderEmail = ?)
    `;

    const attachment = await db.prepare(attachmentQuery)
      .bind(attachmentId, userEmail, userEmail)
      .first() as any;

    if (!attachment) {
      return new Response('Attachment not found or access denied', { status: 404 });
    }

    // Only allow preview for image files
    if (!attachment.ContentType.startsWith('image/')) {
      return new Response('Preview not available for this file type', { status: 400 });
    }

    // Get the file from R2
    const object = await r2.get(attachment.R2Key);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Return the image for preview
    const headers = new Headers();
    headers.set('Content-Type', attachment.ContentType);
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    return new Response(object.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error previewing attachment:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

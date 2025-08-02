import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import type { D1Result } from '@cloudflare/workers-types';

export const runtime = 'edge';

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id } = await params;
    const messageId = parseInt(id);
    if (isNaN(messageId)) {
      return new Response(JSON.stringify({ error: 'Invalid message ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has access to this message (either sender or recipient)
    const checkAccessQuery = `
      SELECT 1
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.Id = ? AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      LIMIT 1
    `;

    const accessResult = await db.prepare(checkAccessQuery)
      .bind(messageId, access.email, access.email)
      .first() as any;

    if (!accessResult) {
      return new Response(JSON.stringify({ error: 'Message not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get message recipients with read status
    const recipientsQuery = `
      SELECT 
        mr.RecipientEmail,
        s.Name,
        mr.IsRead,
        mr.ReadAt
      FROM MessageRecipients mr
      LEFT JOIN Subscribers s ON mr.RecipientEmail = s.Email
      WHERE mr.MessageId = ?
      ORDER BY s.Name, mr.RecipientEmail
    `;

    const recipientsResult = await db.prepare(recipientsQuery)
      .bind(messageId)
      .all() as D1Result<any>;

    const recipients = recipientsResult.results || [];

    return new Response(JSON.stringify({ 
      recipients: recipients.map(r => ({
        Email: r.RecipientEmail,
        Name: r.Name || 'Unknown User',
        IsRead: r.IsRead === 1,
        ReadAt: r.ReadAt
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching message recipients:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 
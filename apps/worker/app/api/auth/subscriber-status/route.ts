import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return Response.json({ isSubscriber: false });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is a subscriber
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM Subscribers WHERE Email = ?
    `).bind(userEmail).first();
    
    const isSubscriber = Number(result?.count ?? 0) > 0;

    return Response.json({ isSubscriber });
  } catch (error) {
    console.error('Error checking subscriber status:', error);
    return Response.json({ isSubscriber: false });
  }
} 
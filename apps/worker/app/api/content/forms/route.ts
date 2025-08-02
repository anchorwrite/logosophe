import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const result = await db.prepare(`
      SELECT Id, Name, Description
      FROM Form
      ORDER BY Name ASC
    `).all();

    return new Response(JSON.stringify({
      forms: result.results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching forms:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch forms',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 
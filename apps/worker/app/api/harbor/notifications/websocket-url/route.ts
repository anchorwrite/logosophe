import { NextResponse } from 'next/server';

export const runtime = 'edge';

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https:/logosophe.anchorwrite.workers.dev';

export async function GET() {
  try {
    // Convert https URL to wss URL for WebSocket connections
    const wsUrl = WORKER_URL.replace('https:/', 'wss:/');
    
    return NextResponse.json({
      success: true,
      wsUrl: wsUrl
    });
  } catch (error) {
    console.error('Error getting notification WebSocket URL:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
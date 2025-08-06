import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use the current domain for SSE connections
    const baseUrl = request.headers.get('origin') || 'https://local-dev.logosophe.com';
    const sseUrl = baseUrl;
    
    return NextResponse.json({
      success: true,
      sseUrl: sseUrl
    });
  } catch (error) {
    console.error('Error getting SSE URL:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
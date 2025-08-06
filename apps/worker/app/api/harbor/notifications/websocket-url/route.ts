import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use the current domain for WebSocket connections
    const baseUrl = request.headers.get('origin') || 'https://local-dev.logosophe.com';
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
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
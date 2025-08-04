import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET() {
  try {
    const { env } = await getCloudflareContext({async: true});
    
    // Get all keys from env object
    const envKeys = Object.keys(env);
    
    // Check specific auth variables - these are now secrets, so we need to handle them differently
    const authVars = {
      AUTH_GOOGLE_ID: '***SECRET***', // These are now secrets, not directly accessible
      AUTH_GOOGLE_SECRET: '***SECRET***',
      AUTH_RESEND_KEY: '***SECRET***',
      AUTH_APPLE_ID: '***SECRET***',
      AUTH_APPLE_SECRET: '***SECRET***',
    };
    
    // Try to access secrets safely
    const secretStatus = {
      googleId: typeof (env as any).AUTH_GOOGLE_ID === 'string' ? 'available' : 'not accessible',
      googleSecret: typeof (env as any).AUTH_GOOGLE_SECRET === 'string' ? 'available' : 'not accessible',
      resendKey: typeof (env as any).AUTH_RESEND_KEY === 'string' ? 'available' : 'not accessible',
      appleId: typeof (env as any).AUTH_APPLE_ID === 'string' ? 'available' : 'not accessible',
      appleSecret: typeof (env as any).AUTH_APPLE_SECRET === 'string' ? 'available' : 'not accessible',
    };
    
    return NextResponse.json({
      allEnvKeys: envKeys,
      authVars,
      secretStatus,
      hasDB: !!env.DB,
      envType: typeof env,
      note: 'OAuth variables are now secrets and not directly accessible through env object'
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
} 
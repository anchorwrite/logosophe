import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { auth } from '@/auth';


export async function GET() {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const session = await auth();
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // For test users, return 'Test' as provider
    if (access.email.endsWith('@logosophe.test')) {
      return NextResponse.json({
        success: true,
        provider: 'Test',
        email: access.email
      });
    }

    // For other users, get the provider from the database
    const account = await db.prepare(
      'SELECT provider FROM accounts WHERE userId = ?'
    ).bind(session?.user?.id).first() as { provider: string } | null;

    let provider = account?.provider || 'unknown';
    
    // If no account found, check for other authentication methods
    if (!account) {
      // Check if user is in Credentials table (admin/tenant users)
      const credUser = await db.prepare(
        'SELECT * FROM Credentials WHERE Email = ?'
      ).bind(access.email).first();
      
      if (credUser) {
        provider = 'credentials';
      } else {
        // Check if user has emailVerified (Resend magic link users)
        const user = await db.prepare(
          'SELECT emailVerified FROM users WHERE id = ?'
        ).bind(session?.user?.id).first() as { emailVerified: string | null } | null;
        
        if (user?.emailVerified) {
          provider = 'email';
        }
      }
    }

    return NextResponse.json({
      success: true,
      provider,
      email: access.email
    });

  } catch (error) {
    return new NextResponse('Internal server error', { status: 500 });
  }
} 
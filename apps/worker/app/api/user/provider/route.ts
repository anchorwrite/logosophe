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

    // Check Preferences.CurrentProvider first — set by the session hook on every sign-in
    const prefs = await db.prepare(
      'SELECT CurrentProvider FROM Preferences WHERE Email = ?'
    ).bind(access.email).first() as { CurrentProvider: string | null } | null;

    let rawProvider = prefs?.CurrentProvider;

    if (!rawProvider) {
      // Fallback: look up the most recent account row
      const account = await db.prepare(
        'SELECT providerId FROM "account" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
      ).bind(session?.user?.id).first() as { providerId: string } | null;

      if (account?.providerId) {
        rawProvider = account.providerId;
      } else {
        const credUser = await db.prepare(
          'SELECT 1 FROM Credentials WHERE Email = ?'
        ).bind(access.email).first();
        rawProvider = credUser ? 'credential' : 'magic-link';
      }
    }

    const friendlyNames: Record<string, string> = {
      'magic-link': 'Email',
      'credential': 'Credentials',
      'google': 'Google',
      'apple': 'Apple',
      'linkedin': 'LinkedIn',
      'microsoft': 'Microsoft',
    };
    const provider = friendlyNames[rawProvider.toLowerCase()] ?? (rawProvider.charAt(0).toUpperCase() + rawProvider.slice(1).toLowerCase());

    return NextResponse.json({
      success: true,
      provider,
      email: access.email
    });

  } catch (error) {
    return new NextResponse('Internal server error', { status: 500 });
  }
} 
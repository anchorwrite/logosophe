import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // First check the Preferences table for CurrentProvider
    const preferences = await db.prepare(
      'SELECT CurrentProvider FROM Preferences WHERE Email = ?'
    ).bind(email).first() as { CurrentProvider: string | null } | null;

    console.log('Preferences lookup for email:', email, 'result:', preferences);

    let provider = 'unknown';

    if (preferences?.CurrentProvider) {
      provider = preferences.CurrentProvider;
      console.log('Found provider from Preferences:', provider);
    } else {
      // Fallback: Check if user exists in the BA user table to get their ID
      const userRecord = await db.prepare(
        'SELECT id FROM "user" WHERE email = ?'
      ).bind(email).first() as { id: string } | null;

      if (userRecord?.id) {
        // Try to get provider from BA account table for OAuth users
        const account = await db.prepare(
          'SELECT providerId FROM "account" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
        ).bind(userRecord.id).first() as { providerId: string } | null;

        if (account?.providerId) {
          provider = account.providerId;
        } else {
          // If no account found, check for emailVerified (magic link users)
          const userWithEmailVerified = await db.prepare(
            'SELECT emailVerified FROM "user" WHERE id = ?'
          ).bind(userRecord.id).first() as { emailVerified: string | null } | null;

          if (userWithEmailVerified?.emailVerified) {
            provider = 'email';
          }
        }
      } else {
        // If no user record in 'users' table, check 'Credentials' table
        const credUser = await db.prepare(
          'SELECT 1 FROM Credentials WHERE Email = ?'
        ).bind(email).first();
        
        if (credUser) {
          provider = 'credentials';
        }
      }
    }

    // Map internal provider names to user-friendly names
    const userFriendlyProviderMap: Record<string, string> = {
      'credential': 'Credentials',
      'email': 'Email (Magic Link)',
      'google': 'Google',
      'apple': 'Apple',
      'linkedin': 'LinkedIn',
      'microsoft': 'Microsoft',
      'test': 'Test'
    };

    const userFriendlyProvider = userFriendlyProviderMap[provider.toLowerCase()] || provider;

    console.log('Final provider result:', { provider, userFriendlyProvider });

    return NextResponse.json({
      success: true,
      email,
      provider: userFriendlyProvider
    });

  } catch (error) {
    console.error('Error fetching provider by email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

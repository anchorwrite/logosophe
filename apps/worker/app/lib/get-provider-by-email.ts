'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getProviderByEmail(email: string): Promise<{ provider: string | null; email: string } | null> {
  try {
    if (!email) {
      return null;
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // For test users, return 'Test' as provider
    if (email.endsWith('@logosophe.test')) {
      return {
        provider: 'Test',
        email: email
      };
    }

    // Get user from BA user table
    const user = await db.prepare(
      'SELECT id FROM "user" WHERE email = ?'
    ).bind(email).first() as { id: string } | null;

    if (!user) {
      return null;
    }

    // Get the provider from BA account table
    const account = await db.prepare(
      'SELECT providerId FROM "account" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
    ).bind(user.id).first() as { providerId: string } | null;

    let provider = account?.providerId || 'unknown';

    // If no account found, check for other authentication methods
    if (!account) {
      // Check if user is in Credentials table (admin/tenant users)
      const credUser = await db.prepare(
        'SELECT 1 FROM Credentials WHERE Email = ?'
      ).bind(email).first();

      if (credUser) {
        provider = 'credential';
      } else {
        // Check if user has emailVerified (magic link users)
        const userWithEmailVerified = await db.prepare(
          'SELECT emailVerified FROM "user" WHERE email = ?'
        ).bind(email).first() as { emailVerified: string | null } | null;

        if (userWithEmailVerified?.emailVerified) {
          provider = 'email';
        }
      }
    }

    return {
      provider,
      email: email
    };

  } catch (error) {
    console.error('Error fetching provider by email:', error);
    return null;
  }
}

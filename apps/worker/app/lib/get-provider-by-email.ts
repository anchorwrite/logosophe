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

    // Get user from users table
    const user = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first() as { id: string } | null;

    if (!user) {
      return null;
    }

    // Get the provider from accounts table
    const account = await db.prepare(
      'SELECT provider FROM accounts WHERE userId = ?'
    ).bind(user.id).first() as { provider: string } | null;

    let provider = account?.provider || 'unknown';
    
    // If no account found, check for other authentication methods
    if (!account) {
      // Check if user is in Credentials table (admin/tenant users)
      const credUser = await db.prepare(
        'SELECT * FROM Credentials WHERE Email = ?'
      ).bind(email).first();
      
      if (credUser) {
        provider = 'credentials';
      } else {
        // Check if user has emailVerified (Resend magic link users)
        const userWithEmailVerified = await db.prepare(
          'SELECT emailVerified FROM users WHERE email = ?'
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

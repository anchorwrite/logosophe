'use server'

import { signOut, auth } from '../auth'
import { SystemLogs } from '../../lib/system-logs'
import { headers } from 'next/headers'
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface TenantResult {
  TenantId: string;
}

interface UserResult {
  id: string;
  email: string;
}

export async function handleSignOut(redirectTo?: string) {
  try {
    const context = await getCloudflareContext({async: true});
    const db = context.env.DB;
    const headersList = await headers();
    
    // Get the current session
    const session = await auth();
    
    if (session?.user?.id) {
      try {
        // Get user information
        const user = await db.prepare(
          'SELECT * FROM users WHERE id = ?'
        ).bind(session.user.id).first() as UserResult | null;

        if (user?.email) {
          // Get the account information to determine provider
          const account = await db.prepare(
            'SELECT provider FROM accounts WHERE userId = ?'
          ).bind(session.user.id).first() as { provider: string } | null;
          
          // Determine provider based on account or user role
          let provider = account?.provider || 'unknown';
          if (provider === 'unknown') {
            // Check if user is in Credentials table (admin/tenant)
            const credUser = await db.prepare(
              'SELECT * FROM Credentials WHERE email = ?'
            ).bind(user.email).first();
            
            if (credUser) {
              provider = 'credentials';
            } else {
              // Check if user is in Subscribers table
              const subscriber = await db.prepare(
                'SELECT * FROM Subscribers WHERE email = ?'
              ).bind(user.email).first();
              
              if (subscriber) {
                provider = 'resend'; // Default to resend for subscribers
              }
            }
          }

          // Calculate session duration using session creation time
          const sessionStartTime = new Date(session.expires);
          sessionStartTime.setDate(sessionStartTime.getDate() - 30); // Subtract 30 days to get creation time
          const endTime = new Date();
          const sessionDuration = Math.round((endTime.getTime() - sessionStartTime.getTime()) / 1000); // Duration in seconds

          // Log the signout action using SystemLogs
          const systemLogs = new SystemLogs(db);
          const logData = {
            userId: session.user.id,
            email: user.email,
            provider,
            activityType: 'signout' as const,
            ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
            userAgent: headersList.get('user-agent') || 'unknown',
            metadata: {
              sessionDuration,
              sessionStartTime: sessionStartTime.toISOString(),
              sessionEndTime: endTime.toISOString()
            }
          };
          
          await systemLogs.logAuth(logData);
        }
      } catch (error) {
        // If logging fails, just log the error but don't fail the sign-out
        console.error('Error during sign-out logging:', error);
      }
    }

    // Use provided redirectTo or default to main page
    if (redirectTo === undefined) {
      // For regular sign out, redirect to main page
      await signOut({ redirectTo: '/' })
    } else {
      await signOut({ redirectTo })
    }
  } catch (error) {
    // Only log real errors, not redirects
    if (!(error instanceof Error && error.message === 'NEXT_REDIRECT')) {
      console.error('Signout error:', error)
      throw error
    }
    // Don't re-throw redirect errors - they're expected and handled by Next.js
    return
  }
} 
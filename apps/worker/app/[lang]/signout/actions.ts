'use server'

import { createAuth, auth } from '@/auth'
import { NormalizedLogging } from '@/lib/normalized-logging'
import { headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function handleSignOut() {
  try {
    const context = await getCloudflareContext({ async: true })
    const db = context.env.DB
    const headersList = await headers()
    const session = await auth()

    if (session?.user?.email) {
      try {
        const email = session.user.email

        // Determine provider from BA account table
        const accountRow = await db
          .prepare('SELECT providerId FROM "account" WHERE userId = ? LIMIT 1')
          .bind(session.user.id)
          .first<{ providerId: string }>()
        const provider = accountRow?.providerId || 'credential'

        // Approximate session start time (30 days before expiry)
        const sessionStartTime = new Date(session.expires)
        sessionStartTime.setDate(sessionStartTime.getDate() - 30)
        const endTime = new Date()
        const sessionDuration = Math.round(
          (endTime.getTime() - sessionStartTime.getTime()) / 1000
        )

        const normalizedLogging = new NormalizedLogging(db)
        await normalizedLogging.logAuthentication({
          userEmail: email,
          userId: session.user.id,
          provider,
          activityType: 'signout',
          accessType: 'auth',
          targetId: email,
          targetName: `${email} (${provider})`,
          ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          metadata: {
            sessionDuration,
            sessionStartTime: sessionStartTime.toISOString(),
            sessionEndTime: endTime.toISOString(),
          },
        })
      } catch (err) {
        console.error('Error during sign-out logging:', err)
      }
    }

    const authInstance = await createAuth()
    await authInstance.api.signOut({ headers: await headers() })
  } catch (error) {
    if (!(error instanceof Error && error.message === 'NEXT_REDIRECT')) {
      console.error('Signout error:', error)
      throw error
    }
  }
}

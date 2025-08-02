import { auth } from '@/auth'

export async function getCurrentUser() {
  return await auth()
}

export async function requireAuth() {
  const session = await auth()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}

export async function requireRole(requiredRole: string) {
  const session = await auth()
  if (!session || session.user.role !== requiredRole) {
    throw new Error(`Role ${requiredRole} required`)
  }
  return session
} 
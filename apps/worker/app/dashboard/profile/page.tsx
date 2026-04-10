import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import ProfilePageClient from './ProfilePageClient'


async function updateName(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) {
    return
  }
  const name = formData.get('name') as string
  if (!name) {
    return
  }

  const { env } = await getCloudflareContext({ async: true })
  await env.DB.prepare('UPDATE "user" SET name = ?, updatedAt = ? WHERE id = ?')
    .bind(name, new Date().toISOString(), session.user.id)
    .run()
  await revalidatePath('/dashboard/profile')
  await revalidatePath('/harbor/profile')
}

async function updateEmail(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) {
    return
  }
  const email = formData.get('email') as string
  if (!email) {
    return
  }

  const { env } = await getCloudflareContext({ async: true })
  await env.DB.prepare('UPDATE "user" SET email = ?, updatedAt = ? WHERE id = ?')
    .bind(email, new Date().toISOString(), session.user.id)
    .run()
  await revalidatePath('/dashboard/profile')
  await revalidatePath('/harbor/profile')
}

export default async function ProfilePage() {
  const session = await auth()
  const { env } = await getCloudflareContext({async: true})
  const db = env.DB

  // Check if user is a system admin or tenant admin
  const isAdminUser = await db.prepare(`
    SELECT 1 FROM Credentials 
    WHERE Email = ? AND (Role = 'admin' OR Role = 'tenant')
  `).bind(session?.user?.email || '').first().then(result => !!result)

  return (
    <ProfilePageClient
      session={session}
      updateName={updateName}
      updateEmail={updateEmail}
      isAdminUser={isAdminUser}
    />
  )
} 
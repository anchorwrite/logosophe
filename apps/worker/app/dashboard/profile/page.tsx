import { signIn, signOut, auth } from '@/auth'
import { updateRecord } from '@auth/d1-adapter'
import { cookies } from "next/headers";
import { revalidatePath } from 'next/cache'
import { isSystemAdmin } from '@/lib/access'
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

  const query = `UPDATE users SET name = $1 WHERE id = $2`
  await updateRecord(process.env.DB, query, [name, session.user.id])
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

  const query = `UPDATE users SET email = $1 WHERE id = $2`
  await updateRecord(process.env.DB, query, [email, session.user.id])
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
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import ProfileForm from './ProfileForm'
import { isSystemAdmin } from '@/lib/access'
import { getCloudflareContext } from '@opennextjs/cloudflare'


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
  const isAdminUser = await isSystemAdmin(session?.user?.email || '', env.DB)

  return <ProfileForm 
    session={session} 
    updateName={updateName} 
    updateEmail={updateEmail}
    isAdminUser={isAdminUser}
  />
} 
'use client'

import type { AuthSession } from '@/auth';
import ProfileForm from '@/components/ProfileForm'

interface ProfilePageClientProps {
  session: AuthSession;
  updateName: (formData: FormData) => Promise<void>;
  updateEmail: (formData: FormData) => Promise<void>;
  isAdminUser: boolean;
}

export default function ProfilePageClient({ 
  session, 
  updateName, 
  updateEmail, 
  isAdminUser 
}: ProfilePageClientProps) {
  return (
    <ProfileForm 
      session={session} 
      updateName={updateName} 
      updateEmail={updateEmail}
      isAdminUser={isAdminUser}
    />
  )
} 
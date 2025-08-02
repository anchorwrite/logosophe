'use client'

import { Session } from 'next-auth'
import ProfileForm from '@/components/ProfileForm'

interface ProfilePageClientProps {
  session: Session | null;
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
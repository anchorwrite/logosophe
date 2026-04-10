'use client'

import type { AuthSession } from '@/auth';
import ProfileForm from './ProfileForm'

interface ProfileFormClientProps {
  session: AuthSession;
  updateName: (formData: FormData) => Promise<void>;
  updateEmail: (formData: FormData) => Promise<void>;
  isAdminUser: boolean;
}

export default function ProfileFormClient({ session, updateName, updateEmail, isAdminUser }: ProfileFormClientProps) {
  return (
    <ProfileForm 
      session={session} 
      updateName={updateName} 
      updateEmail={updateEmail}
      isAdminUser={isAdminUser}
    />
  )
} 
'use client'

import { Session } from 'next-auth'
import ProfileForm from './ProfileForm'

interface ProfileFormClientProps {
  session: Session | null;
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
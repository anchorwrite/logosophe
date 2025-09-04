'use client'

import { Flex, Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { handleSignOut } from './actions'

interface SignOutButtonsProps {
  lang: string;
  translations: {
    staySignedIn: string;
    yesSignOut: string;
  };
}

export function SignOutButtons({ lang, translations }: SignOutButtonsProps) {
  const router = useRouter()

  const handleNo = (e: React.MouseEvent) => {
    e.preventDefault()
    router.back()
  }

  const handleYes = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      // First, call the server action for logging and cleanup
      await handleSignOut()
      
      // Then, use NextAuth's client-side signOut to properly invalidate the session
      await signOut({ redirect: false })
      
      // Force a page refresh to ensure all components update their session state
      window.location.href = `/${lang}`
    } catch (error) {
      console.error('Error during signout:', error)
      console.error('Sign out failed')
    }
  }

  return (
    <Flex gap="3" mt="4">
      <Button onClick={handleNo} variant="soft" color="gray">
        {translations.staySignedIn}
      </Button>
      <Button onClick={handleYes} variant="solid" color="red">
        {translations.yesSignOut}
      </Button>
    </Flex>
  )
} 
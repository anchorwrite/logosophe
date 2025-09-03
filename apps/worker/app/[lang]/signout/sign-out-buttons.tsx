'use client'

import { Flex, Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { handleSignOut } from './actions'
import { useTranslation } from 'react-i18next'

interface SignOutButtonsProps {
  lang: string;
}

export function SignOutButtons({ lang }: SignOutButtonsProps) {
  const router = useRouter()
  const { t } = useTranslation('translations')

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
        {t('signout.staySignedIn')}
      </Button>
      <Button onClick={handleYes} variant="solid" color="red">
        {t('signout.yesSignOut')}
      </Button>
    </Flex>
  )
} 
'use client'

import { Flex, Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
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
      await handleSignOut()
      await authClient.signOut()
      window.location.href = `/${lang}`
    } catch (error) {
      console.error('Error during signout:', error)
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

'use client'

import { Flex, Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { handleSignOut } from './actions'

export function SignOutButtons() {
  const router = useRouter()

  const handleNo = (e: React.MouseEvent) => {
    e.preventDefault()
    router.back()
  }

  const handleYes = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await handleSignOut()
      // Redirect to home page after successful signout
      router.push('/')
    } catch (error) {
      console.error('Error during signout:', error)
      console.error('Sign out failed')
    }
  }

  return (
    <Flex gap="3" mt="4">
      <Button onClick={handleNo} variant="soft" color="gray">
        No, Stay Signed In
      </Button>
      <Button onClick={handleYes} variant="solid" color="red">
        Yes, Sign Out
      </Button>
    </Flex>
  )
} 
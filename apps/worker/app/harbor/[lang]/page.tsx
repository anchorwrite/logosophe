import React from 'react'
import { Container, Heading, Text } from '@radix-ui/themes'

interface HarborPageProps {
  params: Promise<{
    lang: string
  }>
}

export default async function HarborPage({ params }: HarborPageProps) {
  const { lang } = await params
  
  return (
    <Container size="4" style={{ padding: '2rem 0' }}>
      <Heading size="6" style={{ marginBottom: '1.5rem' }}>
        Harbor - {lang}
      </Heading>
      <Text color="gray">
        This is the authenticated content creation section for language: {lang}
      </Text>
    </Container>
  )
} 
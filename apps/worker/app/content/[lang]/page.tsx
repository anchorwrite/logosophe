import React from 'react'
import { Container, Heading, Text } from '@radix-ui/themes'

interface ContentPageProps {
  params: Promise<{
    lang: string
  }>
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { lang } = await params
  
  return (
    <Container size="4" style={{ padding: '2rem 0' }}>
      <Heading size="6" style={{ marginBottom: '1.5rem' }}>
        Content - {lang}
      </Heading>
      <Text color="gray">
        This is the public content section for language: {lang}
      </Text>
    </Container>
  )
} 
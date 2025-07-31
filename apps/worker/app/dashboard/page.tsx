import React from 'react'
import { Container, Heading, Text } from '@radix-ui/themes'

export default function DashboardPage() {
  return (
    <Container size="4" style={{ padding: '2rem 0' }}>
      <Heading size="6" style={{ marginBottom: '1.5rem' }}>
        Dashboard
      </Heading>
      <Text color="gray">
        This is the admin dashboard section.
      </Text>
    </Container>
  )
} 
import Link from 'next/link'
import { Container, Heading, Text, Button, Flex } from '@radix-ui/themes'

export default function HomePage() {
  return (
    <Container size="4" style={{ minHeight: '100vh', padding: '4rem 0' }}>
      <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Heading size="8" style={{ marginBottom: '1.5rem' }}>
          Logosophe
        </Heading>
        <Text size="5" color="gray" style={{ marginBottom: '2rem', maxWidth: '32rem', textAlign: 'center' }}>
          A modern content publishing platform built with OpenNext and Cloudflare Workers
        </Text>
        
        <Flex gap="4" direction={{ initial: 'column', sm: 'row' }} justify="center">
          <Button asChild size="3">
            <Link href="/content/en">
              View Content
            </Link>
          </Button>
          <Button asChild size="3" color="green">
            <Link href="/harbor/en">
              Create Content
            </Link>
          </Button>
          <Button asChild size="3" color="purple">
            <Link href="/dashboard">
              Dashboard
            </Link>
          </Button>
        </Flex>
      </Flex>
    </Container>
  )
} 
import { Text, Container, Flex, Box, Card, Button, Heading } from '@radix-ui/themes'
import Link from 'next/link'


export default function ErrorPage() {
  return (
    <Container size="2">
      <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Card size="2">
          <Box p="4">
            <Heading as="h1" size="6" mb="4" align="center">Authentication Error</Heading>
            <Text as="p" size="3" mb="4" align="center">
              An error occurred during authentication. Please try again.
            </Text>
            <Flex gap="3" justify="center">
              <Link href="/signin">
                <Button variant="solid">
                  Back to Sign In
                </Button>
              </Link>
              <Link href="/">
                <Button variant="soft">
                  Go Home
                </Button>
              </Link>
            </Flex>
          </Box>
        </Card>
      </Flex>
    </Container>
  )
} 
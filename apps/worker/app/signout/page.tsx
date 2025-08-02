import { Text, Container, Flex, Box, Card } from '@radix-ui/themes'
import { SignOutButtons } from './sign-out-buttons'

export const runtime = 'edge'

export default async function SignOutPage() {
  return (
    <Container size="2">
      <Flex direction="column" align="center" justify="start" style={{ minHeight: '100vh', paddingTop: '20vh' }}>
        <Card size="2">
          <Box p="4">
            <Text as="div" size="6" mb="4" align="center">Sign Out</Text>
            <Text as="p" size="3" mb="4" align="center">
              Are you sure you want to sign out?
            </Text>
            <SignOutButtons />
          </Box>
        </Card>
      </Flex>
    </Container>
  )
} 
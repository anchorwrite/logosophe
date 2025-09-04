import { Text, Container, Flex, Box, Card } from '@radix-ui/themes'
import { SignOutButtons } from './sign-out-buttons'
import { getDictionary } from '@/lib/dictionary'
import type { Locale } from '@/types/i18n'

export default async function SignOutPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale) as any;
  return (
    <Container size="2">
      <Flex direction="column" align="center" justify="start" style={{ minHeight: '100vh', paddingTop: '20vh' }}>
        <Card size="2">
          <Box p="4">
            <Text as="div" size="6" mb="4" align="center">{dict.signout.title}</Text>
            <Text as="p" size="3" mb="4" align="center">
              {dict.signout.confirmMessage}
            </Text>
            <SignOutButtons lang={lang} translations={dict.signout} />
          </Box>
        </Card>
      </Flex>
    </Container>
  )
} 
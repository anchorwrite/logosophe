import { Metadata } from "next";
import { Container, Box, Flex } from '@radix-ui/themes';
import type { Locale } from '@/types/i18n';
import DashboardAppBar from '@/dashboard/appbar';
import ScrollRestoration from '@/components/ScrollRestoration';


export const metadata: Metadata = {
  title: "Test Users - Logosophe",
  description: "Test user management for Logosophe",
};

type Params = Promise<{ lang: string }>;

export default async function TestUsersLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { lang } = await params;

  return (
    <>
      <ScrollRestoration />
      <Flex direction="column" style={{ minHeight: '100vh' }}>
        <Box asChild style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 50, 
          width: '100%', 
          borderBottom: '1px solid var(--gray-6)',
          backgroundColor: 'var(--color-panel-solid)',
          backdropFilter: 'blur(8px)'
        }}>
          <header>
            <Container size="3">
              <Box style={{ height: '3.5rem', display: 'flex', alignItems: 'center' }}>
                <DashboardAppBar />
              </Box>
            </Container>
          </header>
        </Box>
        <Box asChild grow="1">
          <main>
            <Container size="3" style={{ padding: '1.5rem 0' }}>
              {children}
            </Container>
          </main>
        </Box>
      </Flex>
    </>
  );
} 
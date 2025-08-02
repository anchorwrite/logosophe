import { Metadata } from "next";
import HarborAppBar from "./appbar";
import { Container, Box, Flex } from '@radix-ui/themes';
import type { Locale } from '@/types/i18n';
import Footer from '@/components/Footer';
import ScrollRestoration from '@/components/ScrollRestoration';


// Client component wrapper for Footer
const ClientFooter = () => {
  return <Footer />;
};

export const metadata: Metadata = {
  title: "Harbor | Logosophe",
  description: "Secure content development and sharing for authors",
  openGraph: {
    title: "Harbor | Logosophe",
    description: "Secure content development and sharing for authors",
    type: "website",
    url: "https:/www.logosophe.com/harbor",
  },
  twitter: {
    card: "summary",
    title: "Harbor | Logosophe",
    description: "Secure content development and sharing for authors",
  },
  alternates: {
    canonical: "https:/www.logosophe.com/harbor",
  },
};

type Params = Promise<{ lang: Locale }>;

export default async function HarborLayout({
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
                <HarborAppBar lang={lang} />
              </Box>
            </Container>
          </header>
        </Box>
        <Box asChild>
          <main>
            {children}
          </main>
        </Box>
        <ClientFooter />
      </Flex>
    </>
  );
} 
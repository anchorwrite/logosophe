import { Suspense } from 'react';
import { Box, Container, Heading, Text } from '@radix-ui/themes';
import { SubscriberPagesDirectory } from '@/components/harbor/subscriber-pages/SubscriberPagesDirectory';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface SubscriberPagesPageProps {
  params: Promise<{ lang: 'en' | 'es' | 'de' | 'fr' | 'nl' }>;
}

export default async function SubscriberPagesPage({ params }: SubscriberPagesPageProps) {
  const { lang } = await params;
  
  return (
    <>
      <Header />
      <Container size="4" py="6">
        <Box mb="6">
          <Heading size="8" mb="2">
            Discover Subscriber Pages
          </Heading>
          <Text size="4" color="gray">
            Explore public pages from content creators, authors, and professionals
          </Text>
        </Box>
        
        <Suspense fallback={<div>Loading...</div>}>
          <SubscriberPagesDirectory lang={lang} />
        </Suspense>
      </Container>
      <Footer />
    </>
  );
}

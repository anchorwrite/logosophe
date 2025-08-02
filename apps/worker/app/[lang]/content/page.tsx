import { Suspense } from 'react';
import { ContentListing } from '@/components/content/ContentListing';
import Container from '@/common/Container';
import Header from '@/components/Header';
import Footer from '@/components/Footer';


interface ContentPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { lang } = await params;
  return (
    <>
      <Header />
      <Container>
        <Suspense fallback={<div>Loading content...</div>}>
          <ContentListing lang={lang} />
        </Suspense>
      </Container>
      <Footer />
    </>
  );
} 
import { Suspense } from 'react';
import { ContentViewer } from '@/components/content/ContentViewer';
import Container from '@/common/Container';

export const runtime = 'edge';

interface ContentViewPageProps {
  params: Promise<{
    lang: string;
    token: string;
  }>;
}

export default async function ContentViewPage({ params }: ContentViewPageProps) {
  const { lang, token } = await params;
  return (
    <Container>
      <Suspense fallback={<div>Loading content...</div>}>
        <ContentViewer token={token} lang={lang} />
      </Suspense>
    </Container>
  );
} 
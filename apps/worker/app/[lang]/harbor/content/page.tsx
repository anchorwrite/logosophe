import { Suspense } from 'react';
import { SubscriberContentDashboard } from '@/components/harbor/content/SubscriberContentDashboard';
import Container from '@/common/Container';

interface ContentDashboardPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function ContentDashboardPage({ params }: ContentDashboardPageProps) {
  const { lang } = await params;
  return (
    <Container>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <SubscriberContentDashboard lang={lang} />
      </Suspense>
    </Container>
  );
}

export const runtime = 'edge'; 
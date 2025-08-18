import { Suspense } from 'react';
import { HarborBlocksClient } from './HarborBlocksClient';
import type { Locale } from '@/types/i18n';

type Params = Promise<{ lang: Locale }>;

export default async function HarborBlocksPage({ params }: { params: Params }) {
  const { lang } = await params;
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HarborBlocksClient lang={lang} />
    </Suspense>
  );
}

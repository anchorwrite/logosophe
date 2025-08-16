import { Suspense } from 'react';
import { HarborBlocksClient } from './HarborBlocksClient';

export default function HarborBlocksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HarborBlocksClient />
    </Suspense>
  );
}

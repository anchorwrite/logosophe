import { Suspense } from 'react';
import { checkAccess } from '@/lib/access-control';
import { redirect } from 'next/navigation';
import WorkflowHistoryDetailClient from './WorkflowHistoryDetailClient';
import type { Locale } from '@/types/i18n';

type Params = Promise<{ lang: Locale; id: string }>;

export default async function WorkflowHistoryDetailPage({ params }: { params: Params }) {
  const { lang, id } = await params;

  // Check access
  const accessResult = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
  });

  if (!accessResult.hasAccess) {
    redirect(`/${lang}/signin`);
  }

  // Ensure email and role are not null before passing to component
  if (!accessResult.email || !accessResult.role) {
    redirect(`/${lang}/signin`);
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
      <Suspense fallback={<div>Loading...</div>}>
        <WorkflowHistoryDetailClient 
          workflowId={id} 
          lang={lang}
          userEmail={accessResult.email}
          userRole={accessResult.role}
        />
      </Suspense>
    </div>
  );
} 
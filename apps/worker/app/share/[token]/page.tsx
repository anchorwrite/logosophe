import { Metadata } from 'next';
import { SharedMediaViewer } from '@/components/media/SharedMediaViewer';

export const metadata: Metadata = {
  title: 'Shared Media | Logosophe',
  description: 'View shared media files',
};

export const runtime = 'edge';

interface SharedMediaPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedMediaPage({
  params,
}: SharedMediaPageProps) {
  const { token } = await params;
  return (
    <div className="container mx-auto px-4 py-8">
      <SharedMediaViewer token={token} />
    </div>
  );
} 
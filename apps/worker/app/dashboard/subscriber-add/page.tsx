
import { handleAccessControl } from '@/lib/access-control';
import { SubscriberAddForm } from './SubscriberAddForm';

export default async function SubscriberAddPage() {
  // Only admins can add subscribers
  await handleAccessControl({
    requireAuth: true,
    allowedRoles: ['admin']
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Add New Subscriber</h1>
      <SubscriberAddForm />
    </div>
  );
} 
import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const subscriberConfig: TableConfig = {
  name: 'Subscribers',
  endpoint: '/api/subscribers',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'Email', label: 'Email', type: 'text', required: true },
    { name: 'Name', label: 'Name', type: 'text', required: false },
    { name: 'Provider', label: 'Provider', type: 'text', required: true },
    { name: 'EmailVerified', label: 'Email Verified', type: 'date', required: false },
    { name: 'Joined', label: 'Joined', type: 'date', required: false },
    { name: 'Signin', label: 'Last Sign In', type: 'date', required: false },
    { name: 'Active', label: 'Active', type: 'checkbox', required: false },
    { name: 'CreatedAt', label: 'Created At', type: 'date', required: true },
    { name: 'UpdatedAt', label: 'Updated At', type: 'date', required: true }
  ]
};

export default async function SubscribersPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="mx-4 max-w-full">
      <DataTable config={subscriberConfig} />
    </div>
  );
} 
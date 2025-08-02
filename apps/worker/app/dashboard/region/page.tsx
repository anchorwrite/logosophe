import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const regionConfig: TableConfig = {
  name: 'Region',
  endpoint: '/api/region',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'RegionDescription', label: 'Region Description', type: 'text', required: true }
  ]
};

export default async function RegionPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={regionConfig} />
} 
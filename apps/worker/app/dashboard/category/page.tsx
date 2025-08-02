import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const categoryConfig: TableConfig = {
  name: 'Category',
  endpoint: '/api/category',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'CategoryName', label: 'Category Name', type: 'text', required: true },
    { name: 'Description', label: 'Description', type: 'text', required: true }
  ]
};

export default async function CategoryPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={categoryConfig} />
}
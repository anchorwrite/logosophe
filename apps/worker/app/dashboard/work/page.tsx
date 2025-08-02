import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const workConfig: TableConfig = {
  name: 'Work',
  endpoint: '/api/work',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'WorkName', label: 'Work Name', type: 'text', required: true },
    { name: 'CreatorId', label: 'Creator ID', type: 'text', required: true },
    { name: 'CategoryId', label: 'Category ID', type: 'text', required: true },
    { name: 'QuantityPerUnit', label: 'Quantity Per Unit', type: 'text', required: true },
    { name: 'UnitPrice', label: 'Unit Price', type: 'text', required: true },
    { name: 'UnitsInStock', label: 'Units In Stock', type: 'text', required: true },
    { name: 'UnitsOnOrder', label: 'Units On Order', type: 'text', required: true },
    { name: 'ReorderLevel', label: 'Reorder Level', type: 'text', required: true },
    { name: 'Discontinued', label: 'Discontinued', type: 'text', required: true }
  ]
};

export default async function WorkPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={workConfig} />
} 
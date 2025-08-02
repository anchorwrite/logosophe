import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';


const customerConfig: TableConfig = {
  name: 'Customer',
  endpoint: '/api/customer',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'CompanyName', label: 'Company Name', type: 'text', required: true },
    { name: 'ContactName', label: 'Contact Name', type: 'text', required: true },
    { name: 'ContactTitle', label: 'Contact Title', type: 'text', required: true },
    { name: 'Address', label: 'Address', type: 'text', required: true },
    { name: 'City', label: 'City', type: 'text', required: true },
    { name: 'Region', label: 'Region', type: 'text', required: true },
    { name: 'PostalCode', label: 'Postal Code', type: 'text', required: true },
    { name: 'Country', label: 'Country', type: 'text', required: true },
    { name: 'Phone', label: 'Phone', type: 'text', required: true },
    { name: 'Pronouns', label: 'Pronouns', type: 'text', required: true }
  ]
};

export default async function CustomerPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={customerConfig} />
} 
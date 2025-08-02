import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const helperConfig: TableConfig = {
  name: 'Helper',
  endpoint: '/api/helper',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'LastName', label: 'Last Name', type: 'text', required: true },
    { name: 'FirstName', label: 'First Name', type: 'text', required: true },
    { name: 'Title', label: 'Title', type: 'text', required: true },
    { name: 'TitleOfCourtesy', label: 'Title of Courtesy', type: 'text', required: true },
    { name: 'BirthDate', label: 'Birth Date', type: 'text', required: true },
    { name: 'HireDate', label: 'Hire Date', type: 'text', required: true },
    { name: 'Address', label: 'Address', type: 'text', required: true },
    { name: 'City', label: 'City', type: 'text', required: true },
    { name: 'Region', label: 'Region', type: 'text', required: true },
    { name: 'PostalCode', label: 'Postal Code', type: 'text', required: true },
    { name: 'Country', label: 'Country', type: 'text', required: true },
    { name: 'HomePhone', label: 'Home Phone', type: 'text', required: true },
    { name: 'Extension', label: 'Extension', type: 'text', required: true },
    { name: 'Photo', label: 'Photo', type: 'text', required: true },
    { name: 'Notes', label: 'Notes', type: 'text', required: true },
    { name: 'ReportsTo', label: 'Reports To', type: 'text', required: true },
    { name: 'PhotoPath', label: 'Photo Path', type: 'text', required: true }
  ]
};

export default async function HelperPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={helperConfig} />
} 
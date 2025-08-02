import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';


const orderConfig: TableConfig = {
  name: 'Order',
  endpoint: '/api/order',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'CustomerId', label: 'Customer ID', type: 'text', required: true },
    { name: 'HelperId', label: 'Helper ID', type: 'text', required: true },
    { name: 'OrderDate', label: 'Order Date', type: 'text', required: true },
    { name: 'RequiredDate', label: 'Required Date', type: 'text', required: true },
    { name: 'ShippedDate', label: 'Shipped Date', type: 'text', required: true },
    { name: 'ShipVia', label: 'Ship Via', type: 'text', required: true },
    { name: 'Freight', label: 'Freight', type: 'text', required: true },
    { name: 'ShipName', label: 'Ship Name', type: 'text', required: true },
    { name: 'ShipAddress', label: 'Ship Address', type: 'text', required: true },
    { name: 'ShipCity', label: 'Ship City', type: 'text', required: true },
    { name: 'ShipRegion', label: 'Ship Region', type: 'text', required: true },
    { name: 'ShipPostalCode', label: 'Ship Postal Code', type: 'text', required: true },
    { name: 'ShipCountry', label: 'Ship Country', type: 'text', required: true }
  ]
};

export default async function OrderPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={orderConfig} />
} 
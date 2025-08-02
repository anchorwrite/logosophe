import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';


const orderDetailConfig: TableConfig = {
  name: 'OrderDetail',
  endpoint: '/api/orderdetail',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'OrderId', label: 'Order ID', type: 'text', required: true },
    { name: 'WorkId', label: 'Work ID', type: 'text', required: true },
    { name: 'UnitPrice', label: 'Unit Price', type: 'text', required: true },
    { name: 'Quantity', label: 'Quantity', type: 'text', required: true },
    { name: 'Discount', label: 'Discount', type: 'text', required: true }
  ]
};

export default async function OrderDetailPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return <DataTable config={orderDetailConfig} />
} 
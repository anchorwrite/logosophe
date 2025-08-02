import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';


const tenantUsersConfig: TableConfig = {
  name: 'Tenant Users',
  endpoint: '/api/tenant-users',
  fields: [
    { name: 'TenantId', label: 'Tenant', type: 'text', required: true },
    { name: 'UserId', label: 'User', type: 'text', required: true },
    { name: 'RoleId', label: 'Role', type: 'text', required: true },
  ],
  compositeKey: true
};

export default function TenantUsersPage() {
  return <DataTable config={tenantUsersConfig} />;
} 
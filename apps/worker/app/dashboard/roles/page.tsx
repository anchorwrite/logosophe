import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';

export const runtime = 'edge'

const rolesConfig: TableConfig = {
  name: 'Roles',
  endpoint: '/api/roles',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'Name', label: 'Name', type: 'text', required: true },
    { name: 'Description', label: 'Description', type: 'text', required: false }
  ]
};

const permissionsConfig: TableConfig = {
  name: 'Permissions',
  endpoint: '/api/permissions',
  fields: [
    { name: 'Id', label: 'ID', type: 'text', required: true },
    { name: 'Name', label: 'Name', type: 'text', required: true },
    { name: 'Description', label: 'Description', type: 'text', required: false },
    { name: 'Resource', label: 'Resource', type: 'text', required: true },
    { name: 'Action', label: 'Action', type: 'text', required: true }
  ]
};

const rolePermissionsConfig: TableConfig = {
  name: 'Role Permissions',
  endpoint: '/api/role-permissions',
  fields: [
    { name: 'RoleId', label: 'Role ID', type: 'text', required: true },
    { name: 'PermissionId', label: 'Permission ID', type: 'text', required: true }
  ]
};

export default async function RolesPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="w-full space-y-8">
      <h1 className="text-2xl font-bold mb-4">Roles & Permissions</h1>
      
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Roles</h2>
          <DataTable config={rolesConfig} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Permissions</h2>
          <DataTable config={permissionsConfig} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Role Permissions</h2>
          <DataTable config={rolePermissionsConfig} />
        </div>
      </div>
    </div>
  );
} 
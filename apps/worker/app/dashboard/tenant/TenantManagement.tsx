'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, Box, Flex, Text } from '@radix-ui/themes';
import { useRouter, useSearchParams } from 'next/navigation';
import { TenantList, TenantListRef } from './components/TenantList';
import { TenantForm } from './components/TenantForm';

interface Tenant {
  Id: string;
  Name: string;
  Description: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface TenantManagementProps {
  isSystemAdmin: boolean;
  tenants: Tenant[];
}

export default function TenantManagement({ isSystemAdmin, tenants }: TenantManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const tenantListRef = useRef<TenantListRef | null>(null);

  const handleTabChange = (value: string) => {
    console.log('handleTabChange called with value:', value, 'shouldRefresh:', shouldRefresh);
    setActiveTab(value);
    router.push(`/dashboard/tenant?tab=${value}`);
    
    // If switching to list tab and we should refresh, trigger the refresh
    if (value === 'list' && shouldRefresh) {
      console.log('Should refresh, calling refreshTenants');
      setTimeout(() => {
        console.log('Calling tenantListRef.current?.refreshTenants()');
        tenantListRef.current?.refreshTenants();
        setShouldRefresh(false);
      }, 100);
    }
  };

  const handleFormSuccess = () => {
    console.log('handleFormSuccess called');
    setShouldRefresh(true); // Mark that we should refresh when switching to list
    handleTabChange('list');
  };

  return (
    <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
      <Tabs.List>
        <Tabs.Trigger value="list">Tenants</Tabs.Trigger>
        {isSystemAdmin && <Tabs.Trigger value="add">Add Tenant</Tabs.Trigger>}
      </Tabs.List>

      <Box pt="3">
        <Tabs.Content value="list">
          <TenantList 
            ref={tenantListRef}
            onTenantSelect={setSelectedTenant}
            isSystemAdmin={isSystemAdmin}
            userTenants={tenants}
          />
        </Tabs.Content>
        {isSystemAdmin && (
          <Tabs.Content value="add">
            <TenantForm onSuccess={handleFormSuccess} />
          </Tabs.Content>
        )}
      </Box>
    </Tabs.Root>
  );
} 
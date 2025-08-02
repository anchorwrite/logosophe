'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, Text, Flex } from '@radix-ui/themes';
import { useEffect, useState } from 'react';

interface Tenant {
  Id: string;
  Name: string;
}

interface TenantSelectorProps {
  tenants: Tenant[];
  currentTenantId: string;
}

export function TenantSelector({ tenants, currentTenantId }: TenantSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTenantId, setSelectedTenantId] = useState(currentTenantId);

  // Update selected tenant when URL changes
  useEffect(() => {
    const tenantId = searchParams.get('tenantId');
    if (tenantId) {
      setSelectedTenantId(tenantId);
    }
  }, [searchParams]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tenantId', newTenantId);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <Flex align="center" gap="2">
      <Text size="2" weight="medium">Current Tenant:</Text>
      <Select.Root value={selectedTenantId} onValueChange={handleTenantChange}>
        <Select.Trigger style={{ width: '200px' }} />
        <Select.Content>
          {tenants.map((tenant) => (
            <Select.Item key={tenant.Id} value={tenant.Id}>
              {tenant.Name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  );
} 
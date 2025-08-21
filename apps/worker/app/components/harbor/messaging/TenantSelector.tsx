'use client';

import React from 'react';
import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface UserTenant {
  TenantId: string;
  TenantName: string;
  UserRoles: string[];
}

interface TenantSelectorProps {
  userTenants: UserTenant[];
  selectedTenants: string[];
  onTenantChange: (tenants: string[]) => void;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({
  userTenants,
  selectedTenants,
  onTenantChange
}) => {
  const { t } = useTranslation('translations');

  const handleSelectAll = () => {
    onTenantChange(userTenants.map(t => t.TenantId));
  };
  
  const handleClearAll = () => {
    onTenantChange([]);
  };

  const handleTenantToggle = (tenantId: string) => {
    if (selectedTenants.includes(tenantId)) {
      onTenantChange(selectedTenants.filter(t => t !== tenantId));
    } else {
      onTenantChange([...selectedTenants, tenantId]);
    }
  };

  if (userTenants.length === 0) {
    return (
      <Box>
        <Text color="gray">No tenants available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="3" style={{ marginBottom: '1rem' }}>
        Select Tenants
      </Heading>
      
      {userTenants.map(tenant => (
        <Flex key={tenant.TenantId} align="center" style={{ marginBottom: '0.5rem' }}>
          <input
            type="checkbox"
            id={`tenant-${tenant.TenantId}`}
            checked={selectedTenants.includes(tenant.TenantId)}
            onChange={() => handleTenantToggle(tenant.TenantId)}
            style={{ marginRight: '0.5rem' }}
          />
          <label htmlFor={`tenant-${tenant.TenantId}`} style={{ cursor: 'pointer' }}>
            <Text>
              {tenant.TenantName} ({tenant.UserRoles.join(', ')})
            </Text>
          </label>
        </Flex>
      ))}
      
      <Flex gap="2" style={{ marginTop: '1rem' }}>
        <Button variant="soft" onClick={handleSelectAll}>
          Select All Tenants
        </Button>
        <Button variant="soft" onClick={handleClearAll}>
          Clear All
        </Button>
      </Flex>
    </Box>
  );
};

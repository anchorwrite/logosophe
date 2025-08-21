'use client';

import { useState } from 'react';
import { Box, Text, Flex, Button, Checkbox } from '@radix-ui/themes';

interface Tenant {
  Id: string;
  Name: string;
  UserCount: number;
}

interface TenantSelectorProps {
  tenants: Tenant[];
  selectedTenants: string[];
  onTenantsChange: (tenants: string[]) => void;
  disabled?: boolean;
}

export function TenantSelector({
  tenants,
  selectedTenants,
  onTenantsChange,
  disabled = false
}: TenantSelectorProps) {
  const handleTenantToggle = (tenantId: string) => {
    if (disabled) return;
    
    const newSelectedTenants = selectedTenants.includes(tenantId)
      ? selectedTenants.filter(id => id !== tenantId)
      : [...selectedTenants, tenantId];
    
    onTenantsChange(newSelectedTenants);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onTenantsChange(tenants.map(t => t.Id));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onTenantsChange([]);
  };

  if (tenants.length === 0) {
    return (
      <Box>
        <Text size="2" color="gray">No tenants available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
        <Text size="2" weight="medium">Select Tenants</Text>
        <Flex gap="2">
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleSelectAll}
            disabled={disabled || selectedTenants.length === tenants.length}
          >
            Select All Tenants
          </Button>
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleClearAll}
            disabled={disabled || selectedTenants.length === 0}
          >
            Clear All
          </Button>
        </Flex>
      </Flex>
      
      <Box style={{ 
        maxHeight: '120px', 
        overflow: 'auto', 
        border: '1px solid var(--gray-6)', 
        borderRadius: '4px',
        padding: '0.5rem'
      }}>
        <Flex direction="column" gap="1">
          {tenants.map((tenant) => (
            <Flex key={tenant.Id} align="center" gap="2">
              <Checkbox
                id={`tenant-${tenant.Id}`}
                checked={selectedTenants.includes(tenant.Id)}
                onCheckedChange={() => handleTenantToggle(tenant.Id)}
                disabled={disabled}
              />
              <label 
                htmlFor={`tenant-${tenant.Id}`}
                style={{ 
                  cursor: disabled ? 'not-allowed' : 'pointer', 
                  flex: '1',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    {tenant.Name || tenant.Id}
                  </Text>
                  <Text size="1" color="gray">
                    ({tenant.UserCount} users)
                  </Text>
                </Flex>
              </label>
            </Flex>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}

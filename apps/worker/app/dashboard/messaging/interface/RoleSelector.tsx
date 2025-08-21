'use client';

import { useMemo } from 'react';
import { Box, Text, Flex, Button, Checkbox } from '@radix-ui/themes';

interface Role {
  TenantId: string;
  RoleId: string;
  UserCount: number;
}

interface RoleSelectorProps {
  roles: Role[];
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
  disabled?: boolean;
  selectedTenants?: string[]; // Add this to scope role selection to selected tenants
}

export function RoleSelector({
  roles,
  selectedRoles,
  onRolesChange,
  disabled = false,
  selectedTenants = []
}: RoleSelectorProps) {
  // Filter roles to only show those from selected tenants, or all if no tenants selected
  const filteredRoles = useMemo(() => {
    if (selectedTenants.length === 0) {
      return roles; // Show all roles if no tenants are selected
    }
    return roles.filter(role => selectedTenants.includes(role.TenantId));
  }, [roles, selectedTenants]);

  // Group roles by tenant
  const rolesByTenant = useMemo(() => {
    const grouped: Record<string, Role[]> = {};
    filteredRoles.forEach(role => {
      if (!grouped[role.TenantId]) {
        grouped[role.TenantId] = [];
      }
      grouped[role.TenantId].push(role);
    });
    return grouped;
  }, [filteredRoles]);

  const handleRoleToggle = (roleId: string) => {
    if (disabled) return;
    
    const newSelectedRoles = selectedRoles.includes(roleId)
      ? selectedRoles.filter(id => id !== roleId)
      : [...selectedRoles, roleId];
    
    onRolesChange(newSelectedRoles);
  };

  const handleSelectAllInTenant = (tenantId: string) => {
    if (disabled) return;
    const tenantRoles = rolesByTenant[tenantId] || [];
    const tenantRoleIds = tenantRoles.map(r => r.RoleId);
    const newSelectedRoles = [...new Set([...selectedRoles, ...tenantRoleIds])];
    onRolesChange(newSelectedRoles);
  };

  const handleClearAllInTenant = (tenantId: string) => {
    if (disabled) return;
    const tenantRoles = rolesByTenant[tenantId] || [];
    const tenantRoleIds = tenantRoles.map(r => r.RoleId);
    const newSelectedRoles = selectedRoles.filter(id => !tenantRoleIds.includes(id));
    onRolesChange(newSelectedRoles);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allRoleIds = filteredRoles.map(r => r.RoleId);
    onRolesChange(allRoleIds);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onRolesChange([]);
  };

  if (roles.length === 0) {
    return (
      <Box>
        <Text size="2" color="gray">No roles available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
        <Text size="2" weight="medium">Select Roles</Text>
        <Flex gap="2">
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleSelectAll}
            disabled={disabled || selectedRoles.length === filteredRoles.length}
          >
            Select All Roles
          </Button>
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleClearAll}
            disabled={disabled || selectedRoles.length === 0}
          >
            Clear All Roles
          </Button>
        </Flex>
      </Flex>
      
      <Box style={{ 
        maxHeight: '200px', 
        overflow: 'auto', 
        border: '1px solid var(--gray-6)', 
        borderRadius: '4px',
        padding: '0.5rem'
      }}>
        {Object.entries(rolesByTenant).map(([tenantId, tenantRoles]) => (
          <Box key={tenantId} style={{ marginBottom: '1rem' }}>
            <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
              <Text size="2" weight="medium">{tenantId}</Text>
              <Flex gap="2">
                <Button 
                  size="1" 
                  variant="soft" 
                  onClick={() => handleSelectAllInTenant(tenantId)}
                  disabled={disabled}
                >
                  Select All
                </Button>
                <Button 
                  size="1" 
                  variant="soft" 
                  onClick={() => handleClearAllInTenant(tenantId)}
                  disabled={disabled}
                >
                  Clear All
                </Button>
              </Flex>
            </Flex>
            
            <Flex direction="column" gap="1">
              {tenantRoles.map((role) => (
                <Flex key={`${role.TenantId}-${role.RoleId}`} align="center" gap="2">
                  <Checkbox
                    id={`role-${role.TenantId}-${role.RoleId}`}
                    checked={selectedRoles.includes(role.RoleId)}
                    onCheckedChange={() => handleRoleToggle(role.RoleId)}
                    disabled={disabled}
                  />
                  <label 
                    htmlFor={`role-${role.TenantId}-${role.RoleId}`}
                    style={{ 
                      cursor: disabled ? 'not-allowed' : 'pointer', 
                      flex: '1',
                      opacity: disabled ? 0.6 : 1
                    }}
                  >
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        {role.RoleId.charAt(0).toUpperCase() + role.RoleId.slice(1)}s
                      </Text>
                      <Text size="1" color="gray">
                        ({role.UserCount} users)
                      </Text>
                    </Flex>
                  </label>
                </Flex>
              ))}
            </Flex>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

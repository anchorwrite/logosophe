'use client';

import React from 'react';
import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface Role {
  TenantId: string;
  RoleId: string;
  UserCount: number;
}

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  TenantName: string;
  RoleId: string;
  IsBlocked: boolean;
}

interface RoleSelectorProps {
  roles: Role[];
  recipients: Recipient[];
  selectedRoles: string[];
  onRoleChange: (roles: string[]) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  roles,
  recipients,
  selectedRoles,
  onRoleChange
}) => {
  const { t } = useTranslation('translations');

  console.log('RoleSelector - Received roles:', roles);
  console.log('RoleSelector - Received recipients:', recipients);
  console.log('RoleSelector - Selected roles:', selectedRoles);

  // Group roles by tenant
  const rolesByTenant = roles.reduce((acc, role) => {
    if (!acc[role.TenantId]) {
      acc[role.TenantId] = [];
    }
    acc[role.TenantId].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  console.log('RoleSelector - Roles by tenant:', rolesByTenant);

  const handleSelectAllRoles = () => {
    onRoleChange(roles.map(r => r.RoleId));
  };

  const handleClearAllRoles = () => {
    onRoleChange([]);
  };

  const handleRoleToggle = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      onRoleChange(selectedRoles.filter(r => r !== roleId));
    } else {
      onRoleChange([...selectedRoles, roleId]);
    }
  };

  const handleSelectAllInTenant = (tenantId: string) => {
    const tenantRoles = rolesByTenant[tenantId]?.map(r => r.RoleId) || [];
    const newSelectedRoles = [...new Set([...selectedRoles, ...tenantRoles])];
    onRoleChange(newSelectedRoles);
  };

  const handleClearAllInTenant = (tenantId: string) => {
    const tenantRoles = rolesByTenant[tenantId]?.map(r => r.RoleId) || [];
    const newSelectedRoles = selectedRoles.filter(role => !tenantRoles.includes(role));
    onRoleChange(newSelectedRoles);
  };

  if (roles.length === 0) {
    return (
      <Box>
        <Text color="gray">No roles available for selected tenants</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="3" style={{ marginBottom: '1rem' }}>
        Select Roles
      </Heading>
      
      {/* Debug info */}
      <Box style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <Text size="2" color="gray">
          Debug: {roles.length} roles received, {Object.keys(rolesByTenant).length} tenants
        </Text>
        <Text size="2" color="gray">
          Roles: {JSON.stringify(roles)}
        </Text>
      </Box>
      
      <Flex gap="2" style={{ marginBottom: '1.5rem' }}>
        <Button variant="soft" onClick={handleSelectAllRoles}>
          Select All Roles
        </Button>
        <Button variant="soft" onClick={handleClearAllRoles}>
          Clear All Roles
        </Button>
      </Flex>

      {Object.entries(rolesByTenant).map(([tenantId, tenantRoles]) => {
        console.log('Rendering tenant:', tenantId, 'with roles:', tenantRoles);
        return (
          <Box key={tenantId} style={{ marginBottom: '1.5rem', border: '2px solid red', padding: '1rem' }}>
            <Flex align="center" justify="between" style={{ marginBottom: '0.5rem' }}>
              <Heading size="4">
                {recipients.find(r => r.TenantId === tenantId)?.TenantName || tenantId}
              </Heading>
              <Flex gap="2">
                <Button 
                  variant="soft" 
                  size="1" 
                  onClick={() => handleSelectAllInTenant(tenantId)}
                >
                  Select All
                </Button>
                <Button 
                  variant="soft" 
                  size="1" 
                  onClick={() => handleClearAllInTenant(tenantId)}
                >
                  Clear All
                </Button>
              </Flex>
            </Flex>
            
            {/* Debug: Show tenantRoles array */}
            <Box style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>
              <Text size="2" color="red">
                Debug: tenantRoles array has {tenantRoles.length} items
              </Text>
              <Text size="2" color="red">
                tenantRoles: {JSON.stringify(tenantRoles)}
              </Text>
            </Box>
            
            {tenantRoles.map((role, index) => {
              console.log('Rendering role:', role, 'at index:', index);
              return (
                <Flex key={role.RoleId} align="center" style={{ marginBottom: '0.5rem', marginLeft: '1rem', border: '1px solid #ccc', padding: '0.5rem', borderRadius: '4px' }}>
                  <input
                    type="checkbox"
                    id={`role-${tenantId}-${role.RoleId}`}
                    checked={selectedRoles.includes(role.RoleId)}
                    onChange={() => handleRoleToggle(role.RoleId)}
                    style={{ marginRight: '0.5rem', width: '20px', height: '20px' }}
                  />
                  <label htmlFor={`role-${tenantId}-${role.RoleId}`} style={{ cursor: 'pointer' }}>
                    <Text>
                      {role.RoleId.charAt(0).toUpperCase() + role.RoleId.slice(1)}s ({role.UserCount} users)
                    </Text>
                  </label>
                  {/* Debug info for each role */}
                  <Text size="1" color="gray" style={{ marginLeft: '1rem' }}>
                    [Debug: RoleId={role.RoleId}, UserCount={role.UserCount}]
                  </Text>
                </Flex>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};
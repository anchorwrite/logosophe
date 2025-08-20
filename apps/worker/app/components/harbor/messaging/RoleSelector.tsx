'use client';

import React from 'react';
import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface Role {
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

  // Group recipients by tenant and role
  const recipientsByTenant = recipients.reduce((acc, recipient) => {
    if (!acc[recipient.TenantId]) {
      acc[recipient.TenantId] = {};
    }
    if (!acc[recipient.TenantId][recipient.RoleId]) {
      acc[recipient.TenantId][recipient.RoleId] = [];
    }
    acc[recipient.TenantId][recipient.RoleId].push(recipient);
    return acc;
  }, {} as Record<string, Record<string, Recipient[]>>);

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
    const tenantRoles = Object.keys(recipientsByTenant[tenantId] || {});
    const newSelectedRoles = [...new Set([...selectedRoles, ...tenantRoles])];
    onRoleChange(newSelectedRoles);
  };

  const handleClearAllInTenant = (tenantId: string) => {
    const tenantRoles = Object.keys(recipientsByTenant[tenantId] || {});
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
        {t('messaging.selectRoles')}
      </Heading>
      
      <Flex gap="2" style={{ marginBottom: '1.5rem' }}>
        <Button variant="soft" onClick={handleSelectAllRoles}>
          {t('messaging.selectAllRoles')}
        </Button>
        <Button variant="soft" onClick={handleClearAllRoles}>
          {t('messaging.clearAllRoles')}
        </Button>
      </Flex>

      {Object.entries(recipientsByTenant).map(([tenantId, rolesInTenant]) => (
        <Box key={tenantId} style={{ marginBottom: '1.5rem' }}>
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
                {t('messaging.selectAll')}
              </Button>
              <Button 
                variant="soft" 
                size="1" 
                onClick={() => handleClearAllInTenant(tenantId)}
              >
                {t('messaging.clearAll')}
              </Button>
            </Flex>
          </Flex>
          
          {Object.entries(rolesInTenant).map(([roleId, users]) => (
            <Flex key={roleId} align="center" style={{ marginBottom: '0.5rem', marginLeft: '1rem' }}>
              <input
                type="checkbox"
                id={`role-${tenantId}-${roleId}`}
                checked={selectedRoles.includes(roleId)}
                onChange={() => handleRoleToggle(roleId)}
                style={{ marginRight: '0.5rem' }}
              />
              <label htmlFor={`role-${tenantId}-${roleId}`} style={{ cursor: 'pointer' }}>
                <Text>
                  {roleId.charAt(0).toUpperCase() + roleId.slice(1)}s ({users.length} users)
                </Text>
              </label>
            </Flex>
          ))}
        </Box>
      ))}
    </Box>
  );
};
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

  // Group roles by tenant
  const rolesByTenant = roles.reduce((acc, role) => {
    if (!acc[role.TenantId]) {
      acc[role.TenantId] = [];
    }
    acc[role.TenantId].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

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
        <Text color="gray">{t('messaging.noRecipients')}</Text>
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

      {Object.entries(rolesByTenant).map(([tenantId, tenantRoles]) => (
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
          
          {tenantRoles.map((role) => (
            <Flex key={role.RoleId} align="center" style={{ marginBottom: '0.5rem', marginLeft: '1rem' }}>
              <input
                type="checkbox"
                id={`role-${tenantId}-${role.RoleId}`}
                checked={selectedRoles.includes(role.RoleId)}
                onChange={() => handleRoleToggle(role.RoleId)}
                style={{ marginRight: '0.5rem' }}
              />
              <label htmlFor={`role-${tenantId}-${role.RoleId}`} style={{ cursor: 'pointer' }}>
                <Text>
                  {t(`messaging.roleNames.${role.RoleId}`)} ({role.UserCount} {t('messaging.users')})
                </Text>
              </label>
            </Flex>
          ))}
        </Box>
      ))}
    </Box>
  );
};
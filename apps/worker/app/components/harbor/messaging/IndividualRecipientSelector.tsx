'use client';

import React from 'react';
import { Box, Button, Flex, Heading, Text, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  TenantName: string;
  RoleId: string;
  IsBlocked: boolean;
  BlockerEmail?: string;
}

interface IndividualRecipientSelectorProps {
  recipients: Recipient[];
  selectedRecipients: string[];
  onRecipientChange: (recipients: string[]) => void;
}

export const IndividualRecipientSelector: React.FC<IndividualRecipientSelectorProps> = ({
  recipients,
  selectedRecipients,
  onRecipientChange
}) => {
  const { t } = useTranslation('translations');

  const handleSelectAll = () => {
    const nonBlockedRecipients = recipients.filter(r => !r.IsBlocked).map(r => r.Email);
    onRecipientChange(nonBlockedRecipients);
  };

  const handleClearAll = () => {
    onRecipientChange([]);
  };

  const handleRecipientToggle = (email: string) => {
    const recipient = recipients.find(r => r.Email === email);
    if (recipient && recipient.IsBlocked) {
      return; // Don't allow toggling blocked users
    }

    if (selectedRecipients.includes(email)) {
      onRecipientChange(selectedRecipients.filter(r => r !== email));
    } else {
      onRecipientChange([...selectedRecipients, email]);
    }
  };

  const handleSelectAllInTenant = (tenantId: string) => {
    const tenantRecipients = Object.keys(recipientsByTenant[tenantId] || {});
    const newSelected = [...new Set([...selectedRecipients, ...tenantRecipients])];
    onRecipientChange(newSelected);
  };

  const handleClearAllInTenant = (tenantId: string) => {
    const tenantRecipients = Object.keys(recipientsByTenant[tenantId] || {});
    const newSelected = selectedRecipients.filter(email => !tenantRecipients.includes(email));
    onRecipientChange(newSelected);
  };

  // Group recipients by tenant, then by email to consolidate roles
  const recipientsByTenant = recipients.reduce((acc, recipient) => {
    if (!acc[recipient.TenantId]) {
      acc[recipient.TenantId] = {};
    }
    if (!acc[recipient.TenantId][recipient.Email]) {
      acc[recipient.TenantId][recipient.Email] = {
        Email: recipient.Email,
        Name: recipient.Name,
        TenantId: recipient.TenantId,
        TenantName: recipient.TenantName,
        Roles: [],
        IsBlocked: recipient.IsBlocked,
        BlockerEmail: recipient.BlockerEmail
      };
    }
    acc[recipient.TenantId][recipient.Email].Roles.push(recipient.RoleId);
    return acc;
  }, {} as Record<string, Record<string, { Email: string; Name: string; TenantId: string; TenantName: string; Roles: string[]; IsBlocked: boolean; BlockerEmail?: string }>>);

  if (recipients.length === 0) {
    return (
      <Box>
        <Text color="gray">{t('messaging.noRecipients')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="3" style={{ marginBottom: '1rem' }}>
        {t('messaging.selectIndividualRecipients')} ({t('messaging.optional')})
      </Heading>
      
      <Flex gap="2" style={{ marginBottom: '1.5rem' }}>
        <Button variant="soft" onClick={handleSelectAll}>
          {t('messaging.selectAllRecipients')}
        </Button>
        <Button variant="soft" onClick={handleClearAll}>
          {t('messaging.clearAllRecipients')}
        </Button>
      </Flex>

      {Object.entries(recipientsByTenant).map(([tenantId, tenantRecipients]) => (
        <Box key={tenantId} style={{ marginBottom: '1.5rem' }}>
          <Flex align="center" justify="between" style={{ marginBottom: '0.5rem' }}>
            <Heading size="4">
              {Object.values(tenantRecipients)[0]?.TenantName || tenantId}
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
          
          {Object.values(tenantRecipients).map((recipient) => (
            <Flex key={recipient.Email} align="center" style={{ marginBottom: '0.5rem', marginLeft: '1rem' }}>
              <input
                type="checkbox"
                id={`recipient-${recipient.Email}`}
                checked={selectedRecipients.includes(recipient.Email)}
                onChange={() => handleRecipientToggle(recipient.Email)}
                disabled={recipient.IsBlocked}
                style={{ marginRight: '0.5rem' }}
              />
              <label 
                htmlFor={`recipient-${recipient.Email}`} 
                style={{ 
                  cursor: recipient.IsBlocked ? 'not-allowed' : 'pointer',
                  opacity: recipient.IsBlocked ? 0.6 : 1
                }}
              >
                <Flex align="center" gap="2">
                  <Text>
                    {recipient.Name || recipient.Email} ({recipient.Roles.map(roleId => t(`messaging.roleNames.${roleId}`)).join(', ')})
                  </Text>
                  {recipient.IsBlocked ? (
                    <Badge color="red" size="1">
                      {t('messaging.blocked')}
                    </Badge>
                  ) : null}
                </Flex>
              </label>
            </Flex>
          ))}
        </Box>
      ))}
    </Box>
  );
};
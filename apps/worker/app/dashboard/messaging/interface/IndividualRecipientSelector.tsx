'use client';

import { useMemo } from 'react';
import { Box, Text, Flex, Button, Checkbox, Badge } from '@radix-ui/themes';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  BlockerEmail?: string;
}

interface IndividualRecipientSelectorProps {
  recipients: Recipient[];
  selectedRecipients: string[];
  onRecipientChange: (recipients: string[]) => void;
  disabled?: boolean;
}

export function IndividualRecipientSelector({
  recipients,
  selectedRecipients,
  onRecipientChange,
  disabled = false
}: IndividualRecipientSelectorProps) {
  // Group recipients by tenant and email, collecting all roles
  const recipientsByTenant = useMemo(() => {
    const grouped: Record<string, Array<Recipient & { Roles: string[] }>> = {};
    
    recipients.forEach(recipient => {
      if (!grouped[recipient.TenantId]) {
        grouped[recipient.TenantId] = [];
      }
      
      const existingRecipient = grouped[recipient.TenantId].find(r => r.Email === recipient.Email);
      if (existingRecipient) {
        existingRecipient.Roles.push(recipient.RoleId);
      } else {
        grouped[recipient.TenantId].push({
          ...recipient,
          Roles: [recipient.RoleId]
        });
      }
    });
    
    return grouped;
  }, [recipients]);

  const handleRecipientToggle = (email: string) => {
    if (disabled) return;
    
    const newSelectedRecipients = selectedRecipients.includes(email)
      ? selectedRecipients.filter(r => r !== email)
      : [...selectedRecipients, email];
    
    onRecipientChange(newSelectedRecipients);
  };

  const handleSelectAllInTenant = (tenantId: string) => {
    if (disabled) return;
    const tenantRecipients = recipientsByTenant[tenantId] || [];
    const availableRecipients = tenantRecipients.filter(r => !r.IsBlocked).map(r => r.Email);
    const newSelectedRecipients = [...new Set([...selectedRecipients, ...availableRecipients])];
    onRecipientChange(newSelectedRecipients);
  };

  const handleClearAllInTenant = (tenantId: string) => {
    if (disabled) return;
    const tenantRecipients = recipientsByTenant[tenantId] || [];
    const tenantEmails = tenantRecipients.map(r => r.Email);
    const newSelectedRecipients = selectedRecipients.filter(email => !tenantEmails.includes(email));
    onRecipientChange(newSelectedRecipients);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const availableRecipients = recipients.filter(r => !r.IsBlocked).map(r => r.Email);
    onRecipientChange(availableRecipients);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onRecipientChange([]);
  };

  if (recipients.length === 0) {
    return (
      <Box>
        <Text size="2" color="gray">No recipients available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
        <Text size="2" weight="medium">Select Individual Recipients (Optional)</Text>
        <Flex gap="2">
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleSelectAll}
            disabled={disabled || selectedRecipients.length === recipients.filter(r => !r.IsBlocked).length}
          >
            Select All Recipients
          </Button>
          <Button 
            size="1" 
            variant="soft" 
            onClick={handleClearAll}
            disabled={disabled || selectedRecipients.length === 0}
          >
            Clear All Recipients
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
        {Object.entries(recipientsByTenant).map(([tenantId, tenantRecipients]) => (
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
              {tenantRecipients.map((recipient) => (
                <Flex key={recipient.Email} align="center" gap="2">
                  <Checkbox
                    id={`recipient-${recipient.Email}`}
                    checked={selectedRecipients.includes(recipient.Email)}
                    onChange={() => handleRecipientToggle(recipient.Email)}
                    disabled={disabled || recipient.IsBlocked}
                  />
                  <label 
                    htmlFor={`recipient-${recipient.Email}`}
                    style={{ 
                      cursor: (disabled || recipient.IsBlocked) ? 'not-allowed' : 'pointer', 
                      flex: '1',
                      opacity: (disabled || recipient.IsBlocked) ? 0.6 : 1
                    }}
                  >
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium" style={{ color: recipient.IsBlocked ? 'var(--gray-9)' : 'inherit' }}>
                        {recipient.Name || 'Unknown User'}
                      </Text>
                      <Text size="1" color="gray">
                        {recipient.Email}
                      </Text>
                      <Text size="1" color="gray">
                        ({recipient.Roles.join(', ')})
                      </Text>
                      {recipient.IsBlocked ? (
                        <Badge size="1" color="red" variant="solid">
                          {recipient.BlockerEmail ? 'ADMIN BLOCKED' : 'USER BLOCKED'}
                        </Badge>
                      ) : recipient.IsOnline ? (
                        <Badge size="1" color="green">Online</Badge>
                      ) : null}
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

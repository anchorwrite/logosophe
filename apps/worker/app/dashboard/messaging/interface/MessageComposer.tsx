'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Flex, Card, Button, Box, TextField, Badge, Select } from '@radix-ui/themes';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
}

interface SystemSettings {
  messagingEnabled: boolean;
  rateLimitSeconds: number;
  maxRecipients: number;
  recallWindowSeconds: number;
  messageExpiryDays: number;
}

interface MessageComposerProps {
  recipients: Recipient[];
  accessibleTenants: string[];
  onSend: (messageData: {
    subject: string;
    body: string;
    recipients: string[];
    messageType: string;
    tenantId?: string | string[];
  }) => void;
  onCancel: () => void;
  systemSettings: SystemSettings;
}

export function MessageComposer({
  recipients,
  accessibleTenants,
  onSend,
  onCancel,
  systemSettings
}: MessageComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [messageType, setMessageType] = useState('direct');
  const [selectedTenant, setSelectedTenant] = useState(accessibleTenants.length === 1 ? accessibleTenants[0] : '');
  const [isSending, setIsSending] = useState(false);

  // Clear selected recipients when tenant selection changes
  useEffect(() => {
    setSelectedRecipients([]);
  }, [selectedTenant]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
      return;
    }

    if (accessibleTenants.length > 1 && !selectedTenant) {
      alert('Please select a tenant for this message');
      return;
    }

    if (accessibleTenants.length > 1 && selectedTenant === 'all') {
      // When "all" is selected, we'll send to all accessible tenants
      // The backend will need to handle this case
    }

    if (selectedRecipients.length > systemSettings.maxRecipients) {
      alert(`Maximum ${systemSettings.maxRecipients} recipients allowed`);
      return;
    }

    setIsSending(true);
    
    try {
      // Determine the actual tenant ID(s) to send to
      let actualTenantId: string | string[] = selectedTenant;
      if (selectedTenant === 'all') {
        actualTenantId = accessibleTenants;
      }

      await onSend({
        subject: subject.trim(),
        body: body.trim(),
        recipients: selectedRecipients,
        messageType,
        tenantId: actualTenantId
      });
      
      // Reset form
      setSubject('');
      setBody('');
      setSelectedRecipients([]);
      setMessageType('direct');
      setSelectedTenant(accessibleTenants.length === 1 ? accessibleTenants[0] : '');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleRecipientToggle = (email: string) => {
    setSelectedRecipients(prev => 
      prev.includes(email) 
        ? prev.filter(r => r !== email)
        : [...prev, email]
    );
  };

  // Filter recipients based on selected tenant (show blocked users but mark them as blocked)
  const availableRecipients = recipients.filter(r => {
    // If no tenant is selected, show no recipients
    if (!selectedTenant) return false;
    
    // If "all" tenants are selected, show all recipients
    if (selectedTenant === 'all') return true;
    
    // Otherwise, only show recipients from the selected tenant
    return r.TenantId === selectedTenant;
  });

  return (
    <Box style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '0' // Important for flexbox scrolling
    }}>
      {/* Header */}
      <Box style={{ 
        padding: '1.5rem', 
        borderBottom: '1px solid var(--gray-6)',
        flexShrink: 0 // Prevent header from shrinking
      }}>
        <Flex justify="between" align="center">
          <Heading size="4">Compose Message</Heading>
          <Flex gap="2">
            <Button variant="soft" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim() || selectedRecipients.length === 0 || isSending}
            >
              {isSending ? 'Sending...' : 'Send Message'}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Message Form */}
      <Box style={{ 
        flex: '1', 
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem',
        overflow: 'auto',
        minHeight: '0' // Important for flexbox scrolling
      }}>
        {/* Message Type */}
        <Box>
          <Text size="2" style={{ marginBottom: '0.5rem' }}>Message Type</Text>
          <Select.Root value={messageType} onValueChange={setMessageType}>
            <Select.Trigger style={{ width: '200px' }} />
            <Select.Content>
              <Select.Item value="direct">Direct Message</Select.Item>
              <Select.Item value="broadcast">Broadcast</Select.Item>
              <Select.Item value="announcement">Announcement</Select.Item>
            </Select.Content>
          </Select.Root>
        </Box>

        {/* Tenant Selection (if multiple tenants) */}
        {accessibleTenants.length > 1 && (
          <Box>
            <Text size="2" style={{ marginBottom: '0.5rem' }}>Tenant *</Text>
            <Flex gap="2" align="center">
              <Select.Root value={selectedTenant} onValueChange={setSelectedTenant}>
                <Select.Trigger placeholder="Select tenant..." style={{ flex: '1' }} />
                <Select.Content>
                  {accessibleTenants.map(tenantId => {
                    const tenantRecipientCount = recipients.filter(r => r.TenantId === tenantId && !r.IsBlocked).length;
                    return (
                      <Select.Item key={tenantId} value={tenantId}>
                        {tenantId} ({tenantRecipientCount} recipients)
                      </Select.Item>
                    );
                  })}
                </Select.Content>
              </Select.Root>
              <Button 
                variant="soft" 
                size="2"
                onClick={() => setSelectedTenant('all')}
                disabled={selectedTenant === 'all'}
              >
                Select All ({recipients.filter(r => !r.IsBlocked).length} total)
              </Button>
            </Flex>
            {selectedTenant === 'all' && (
              <Text size="1" color="blue" style={{ marginTop: '0.25rem' }}>
                ✓ Message will be sent to all {accessibleTenants.length} accessible tenants
              </Text>
            )}
            <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
              Choose the tenant where this message will be sent, or select all tenants
            </Text>
          </Box>
        )}

        {/* Subject */}
        <Box>
          <Text size="2" style={{ marginBottom: '0.5rem' }}>Subject</Text>
          <TextField.Root>
            <TextField.Input 
              placeholder="Enter message subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </TextField.Root>
        </Box>

        {/* Recipients */}
        <Box>
          <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
            <Text size="2">
              Recipients ({selectedRecipients.length}/{systemSettings.maxRecipients})
              {availableRecipients.length > 0 && (
                <Text size="1" color="gray" style={{ marginLeft: '0.5rem' }}>
                  • {availableRecipients.filter(r => !r.IsBlocked).length} available, {availableRecipients.filter(r => r.IsBlocked).length} blocked for selected tenant(s)
                </Text>
              )}
            </Text>
            {availableRecipients.length > 0 && (
              <Flex gap="2">
                <Button 
                  variant="soft" 
                  size="1"
                  onClick={() => setSelectedRecipients(availableRecipients.filter(r => !r.IsBlocked).map(r => r.Email))}
                  disabled={selectedRecipients.length === availableRecipients.filter(r => !r.IsBlocked).length}
                >
                  Select All
                </Button>
                <Button 
                  variant="soft" 
                  size="1"
                  onClick={() => setSelectedRecipients([])}
                  disabled={selectedRecipients.length === 0}
                >
                  Clear All
                </Button>
              </Flex>
            )}
          </Flex>
          <Box style={{ 
            maxHeight: '120px', 
            overflow: 'auto', 
            border: '1px solid var(--gray-6)', 
            borderRadius: '4px',
            padding: '0.5rem'
          }}>
            {availableRecipients.length === 0 ? (
              <Text size="2" color="gray">
                {!selectedTenant 
                  ? 'Please select a tenant to see available recipients'
                  : selectedTenant === 'all'
                  ? 'No recipients available across all tenants'
                  : `No recipients available in tenant: ${selectedTenant}`
                }
              </Text>
            ) : (
              <Flex direction="column" gap="1">
                {availableRecipients.map((recipient) => (
                  <Flex key={recipient.Email} align="center" gap="2">
                    <input
                      type="checkbox"
                      id={recipient.Email}
                      checked={selectedRecipients.includes(recipient.Email)}
                      onChange={() => handleRecipientToggle(recipient.Email)}
                      disabled={
                        recipient.IsBlocked || 
                        (selectedRecipients.length >= systemSettings.maxRecipients && !selectedRecipients.includes(recipient.Email))
                      }
                    />
                    <label 
                      htmlFor={recipient.Email} 
                      style={{ 
                        cursor: recipient.IsBlocked ? 'not-allowed' : 'pointer', 
                        flex: '1',
                        opacity: recipient.IsBlocked ? 0.6 : 1
                      }}
                    >
                      <Flex align="center" gap="2">
                        <Text size="2" weight="medium" style={{ color: recipient.IsBlocked ? 'var(--gray-9)' : 'inherit' }}>
                          {recipient.Name || 'Unknown User'}
                        </Text>
                        <Text size="1" color="gray">
                          {recipient.Email}
                        </Text>
                        <Badge size="1" variant="soft">{recipient.TenantId}</Badge>
                        {recipient.IsBlocked ? (
                          <Badge size="1" color="red" variant="solid">Blocked</Badge>
                        ) : recipient.IsOnline ? (
                          <Badge size="1" color="green">Online</Badge>
                        ) : null}
                      </Flex>
                    </label>
                  </Flex>
                ))}
              </Flex>
            )}
          </Box>
        </Box>

        {/* Message Body */}
        <Box>
          <Text size="2" style={{ marginBottom: '0.5rem' }}>Message</Text>
          <TextField.Root>
            <TextField.Input 
              placeholder="Type your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ 
                minHeight: '200px',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
          </TextField.Root>
        </Box>

        {/* Message Info */}
        <Box>
          <Text size="1" color="gray">
            Rate limit: {systemSettings.rateLimitSeconds}s between messages • 
            Recall window: {systemSettings.recallWindowSeconds}s • 
            Expiry: {systemSettings.messageExpiryDays} days
          </Text>
        </Box>
        
        {/* Bottom padding for scrolling */}
        <Box style={{ height: '2rem' }} />
      </Box>
    </Box>
  );
} 
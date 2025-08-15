'use client';

import { useState } from 'react';
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
    tenantId?: string;
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

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
      return;
    }

    if (accessibleTenants.length > 1 && !selectedTenant) {
      alert('Please select a tenant for this message');
      return;
    }

    if (selectedRecipients.length > systemSettings.maxRecipients) {
      alert(`Maximum ${systemSettings.maxRecipients} recipients allowed`);
      return;
    }

    setIsSending(true);
    
    try {
      await onSend({
        subject: subject.trim(),
        body: body.trim(),
        recipients: selectedRecipients,
        messageType,
        tenantId: selectedTenant
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

  const availableRecipients = recipients.filter(r => !r.IsBlocked);

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-6)' }}>
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
      <Box style={{ flex: '1', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <Select.Root value={selectedTenant} onValueChange={setSelectedTenant}>
              <Select.Trigger placeholder="Select tenant..." />
              <Select.Content>
                {accessibleTenants.map(tenantId => (
                  <Select.Item key={tenantId} value={tenantId}>{tenantId}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
              Choose the tenant where this message will be sent
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
          <Text size="2" style={{ marginBottom: '0.5rem' }}>
            Recipients ({selectedRecipients.length}/{systemSettings.maxRecipients})
          </Text>
          <Box style={{ 
            maxHeight: '120px', 
            overflow: 'auto', 
            border: '1px solid var(--gray-6)', 
            borderRadius: '4px',
            padding: '0.5rem'
          }}>
            {availableRecipients.length === 0 ? (
              <Text size="2" color="gray">No recipients available</Text>
            ) : (
              <Flex direction="column" gap="1">
                {availableRecipients.map((recipient) => (
                  <Flex key={recipient.Email} align="center" gap="2">
                    <input
                      type="checkbox"
                      id={recipient.Email}
                      checked={selectedRecipients.includes(recipient.Email)}
                      onChange={() => handleRecipientToggle(recipient.Email)}
                      disabled={selectedRecipients.length >= systemSettings.maxRecipients && !selectedRecipients.includes(recipient.Email)}
                    />
                    <label htmlFor={recipient.Email} style={{ cursor: 'pointer', flex: '1' }}>
                      <Flex align="center" gap="2">
                        <Text size="2" weight="medium">
                          {recipient.Name || 'Unknown User'}
                        </Text>
                        <Text size="1" color="gray">
                          {recipient.Email}
                        </Text>
                        <Badge size="1" variant="soft">{recipient.TenantId}</Badge>
                        {recipient.IsOnline && (
                          <Badge size="1" color="green">Online</Badge>
                        )}
                      </Flex>
                    </label>
                  </Flex>
                ))}
              </Flex>
            )}
          </Box>
        </Box>

        {/* Message Body */}
        <Box style={{ flex: '1' }}>
          <Text size="2" style={{ marginBottom: '0.5rem' }}>Message</Text>
          <TextField.Root style={{ height: '100%' }}>
            <TextField.Input 
              placeholder="Type your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ 
                height: '100%', 
                minHeight: '200px',
                resize: 'none'
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
      </Box>
    </Box>
  );
} 
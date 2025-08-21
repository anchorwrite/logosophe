'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Flex, Card, Button, Box, TextField, Badge, Select } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { TenantSelector } from './TenantSelector';
import { RoleSelector } from './RoleSelector';
import { IndividualRecipientSelector } from './IndividualRecipientSelector';
import type { RecentMessage, Recipient, SystemSettings } from './types';

interface Tenant {
  Id: string;
  Name: string;
  UserCount: number;
}

interface Role {
  TenantId: string;
  RoleId: string;
  UserCount: number;
}

interface UnifiedMessageComposerProps {
  tenants: Tenant[];
  roles: Role[];
  recipients: Recipient[];
  userEmail: string;
  onSend: (messageData: {
    subject: string;
    body: string;
    tenants: string[];
    roles: string[];
    individualRecipients: string[];
    messageType: string;
  }) => void;
  onCancel: () => void;
  systemSettings: SystemSettings;
  replyToMessage?: RecentMessage;
  forwardMessage?: RecentMessage;
}

export function UnifiedMessageComposer({
  tenants,
  roles,
  recipients,
  userEmail,
  onSend,
  onCancel,
  systemSettings,
  replyToMessage,
  forwardMessage
}: UnifiedMessageComposerProps) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedIndividualRecipients, setSelectedIndividualRecipients] = useState<string[]>([]);
  const [messageType, setMessageType] = useState('direct');
  const [isSending, setIsSending] = useState(false);

  // Handle reply and forward message data
  useEffect(() => {
    if (replyToMessage) {
      // Reply: Pre-fill subject with "Re:" prefix and set recipients to sender
      setSubject(`Re: ${replyToMessage.Subject}`);
      setBody('');
      setSelectedIndividualRecipients([replyToMessage.SenderEmail]);
      setMessageType('direct');
      // For replies, set the tenant directly from the original message
      setSelectedTenants([replyToMessage.TenantId]);
    } else if (forwardMessage) {
      // Forward: Pre-fill subject with "Fwd:" prefix and include original message
      setSubject(`Fwd: ${forwardMessage.Subject}`);
      setBody(`\n\n--- Forwarded message ---\nFrom: ${forwardMessage.SenderName || forwardMessage.SenderEmail}\nDate: ${new Date(forwardMessage.CreatedAt).toLocaleString()}\nSubject: ${forwardMessage.Subject}\n\n${forwardMessage.Body}`);
      setSelectedIndividualRecipients([]);
      setMessageType('direct');
    }
  }, [replyToMessage, forwardMessage]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Information',
        content: 'Please fill in both subject and message body'
      });
      return;
    }

    // For replies, we have the recipient from the original message
    if (!replyToMessage && selectedTenants.length === 0 && selectedRoles.length === 0 && selectedIndividualRecipients.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Recipients',
        content: 'Please select at least one tenant, role, or individual recipient'
      });
      return;
    }

    // Check recipient limits
    const totalRecipients = selectedIndividualRecipients.length;
    if (totalRecipients > systemSettings.maxRecipients) {
      showToast({
        type: 'warning',
        title: 'Too Many Recipients',
        content: `Maximum ${systemSettings.maxRecipients} individual recipients allowed`
      });
      return;
    }

    setIsSending(true);
    
    try {
      await onSend({
        subject: subject.trim(),
        body: body.trim(),
        tenants: selectedTenants,
        roles: selectedRoles,
        individualRecipients: selectedIndividualRecipients,
        messageType
      });
      
      // Show success toast
      showToast({
        type: 'success',
        title: 'Message Sent',
        content: replyToMessage 
          ? 'Reply sent successfully' 
          : 'Message sent successfully'
      });
      
      // Reset form
      setSubject('');
      setBody('');
      setSelectedTenants([]);
      setSelectedRoles([]);
      setSelectedIndividualRecipients([]);
      setMessageType('direct');
    } catch (error) {
      console.error('Error sending message:', error);
      
      showToast({
        type: 'error',
        title: 'Send Failed',
        content: 'Failed to send message. Please try again.'
      });
    } finally {
      setIsSending(false);
    }
  };



  // Calculate total recipients for display
  const totalRecipients = selectedIndividualRecipients.length;
  const roleBasedRecipients = selectedRoles.length > 0 ? 'Role-based' : 0;

  return (
    <Box style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '0'
    }}>
      {/* Header */}
      <Box style={{ 
        padding: '1.5rem', 
        borderBottom: '1px solid var(--gray-6)',
        flexShrink: 0
      }}>
        <Flex justify="between" align="center">
          <Heading size="4">Compose Message</Heading>
          <Flex gap="2">
            <Button variant="soft" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim() || (!replyToMessage && selectedTenants.length === 0 && selectedRoles.length === 0 && selectedIndividualRecipients.length === 0) || isSending}
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
        minHeight: '0'
      }}>
        {/* Message Type */}
        <Box>
          <Text size="2" style={{ marginBottom: '0.5rem' }}>Message Type</Text>
          <Select.Root value={messageType} onValueChange={setMessageType}>
            <Select.Trigger style={{ width: '200px' }} />
            <Select.Content>
              <Select.Item value="direct">Direct Message (allows replies)</Select.Item>
              <Select.Item value="broadcast">Broadcast (no replies)</Select.Item>
              <Select.Item value="announcement">Announcement (no replies)</Select.Item>
            </Select.Content>
          </Select.Root>
          {messageType !== 'direct' && (
            <Text size="1" color="blue" style={{ marginTop: '0.5rem' }}>
              💡 {messageType === 'broadcast' 
                ? 'Broadcast messages are one-way communications that do not allow replies.'
                : 'Announcement messages are official communications that do not allow replies.'
              }
            </Text>
          )}
        </Box>

        {/* For replies, show a simple recipient display */}
        {replyToMessage ? (
          <Box>
            <Text size="2" style={{ marginBottom: '0.5rem' }}>Reply To</Text>
            <Box style={{ 
              padding: '0.75rem',
              backgroundColor: 'var(--gray-3)',
              border: '1px solid var(--gray-6)',
              borderRadius: '4px'
            }}>
              <Flex align="center" gap="2">
                <Text size="2" weight="medium">
                  {replyToMessage.SenderName || replyToMessage.SenderEmail}
                </Text>
                <Text size="1" color="gray">
                  {replyToMessage.SenderEmail} • {replyToMessage.TenantId}
                </Text>
              </Flex>
            </Box>
            <Text size="1" color="gray" style={{ marginTop: '0.5rem' }}>
              ✓ Replying to the sender of the original message
            </Text>
          </Box>
        ) : (
          <>
            {/* Tenant Selection */}
            <TenantSelector
              tenants={tenants}
              selectedTenants={selectedTenants}
              onTenantsChange={setSelectedTenants}
              disabled={isSending}
            />

            {/* Role Selection */}
            <RoleSelector
              roles={roles}
              selectedRoles={selectedRoles}
              onRolesChange={setSelectedRoles}
              disabled={isSending}
              selectedTenants={selectedTenants}
            />

            {/* Individual Recipient Selection */}
            <IndividualRecipientSelector
              recipients={recipients}
              selectedRecipients={selectedIndividualRecipients}
              onRecipientChange={setSelectedIndividualRecipients}
              disabled={isSending}
            />

            {/* Recipient Summary */}
            {(selectedTenants.length > 0 || selectedRoles.length > 0 || selectedIndividualRecipients.length > 0) && (
              <Box style={{ 
                padding: '0.75rem',
                backgroundColor: 'var(--blue-2)',
                border: '1px solid var(--blue-6)',
                borderRadius: '4px'
              }}>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                  Total Recipients
                </Text>
                <Flex gap="2" wrap="wrap">
                  {selectedTenants.length > 0 && (
                    <Badge size="1" variant="soft">
                      {selectedTenants.length} tenant{selectedTenants.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {selectedRoles.length > 0 && (
                    <Badge size="1" variant="soft">
                      {selectedRoles.length} role{selectedRoles.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {selectedIndividualRecipients.length > 0 && (
                    <Badge size="1" variant="soft">
                      {selectedIndividualRecipients.length} individual{selectedIndividualRecipients.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </Flex>
                <Text size="1" color="gray" style={{ marginTop: '0.5rem' }}>
                  Message will be sent to all users matching the selected criteria
                </Text>
              </Box>
            )}
          </>
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

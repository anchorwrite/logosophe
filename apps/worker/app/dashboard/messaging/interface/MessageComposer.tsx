'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Flex, Card, Button, Box, TextField, Badge, Select } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import type { RecentMessage, Recipient, SystemSettings } from './types';

interface MessageComposerProps {
  recipients: Recipient[];
  accessibleTenants: string[];
  userEmail: string;
  onSend: (messageData: {
    subject: string;
    body: string;
    recipients: string[];
    messageType: string;
    tenantId?: string | string[];
  }) => void;
  onCancel: () => void;
  systemSettings: SystemSettings;
  replyToMessage?: RecentMessage;
  forwardMessage?: RecentMessage;
  hideTenantSelection?: boolean;
}

export function MessageComposer({
  recipients,
  accessibleTenants,
  userEmail,
  onSend,
  onCancel,
  systemSettings,
  replyToMessage,
  forwardMessage,
  hideTenantSelection = false
}: MessageComposerProps) {
  const { showToast } = useToast();
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

  // Handle reply and forward message data
  useEffect(() => {
    if (replyToMessage) {
      // Reply: Pre-fill subject with "Re:" prefix and set recipients to sender
      setSubject(`Re: ${replyToMessage.Subject}`);
      setBody('');
      setSelectedRecipients([replyToMessage.SenderEmail]);
      setMessageType('direct');
      // For replies, set the tenant directly from the original message
      setSelectedTenant(replyToMessage.TenantId);
    } else if (forwardMessage) {
      // Forward: Pre-fill subject with "Fwd:" prefix and include original message
      setSubject(`Fwd: ${forwardMessage.Subject}`);
      setBody(`\n\n--- Forwarded message ---\nFrom: ${forwardMessage.SenderName || forwardMessage.SenderEmail}\nDate: ${new Date(forwardMessage.CreatedAt).toLocaleString()}\nSubject: ${forwardMessage.Subject}\n\n${forwardMessage.Body}`);
      setSelectedRecipients([]);
      setMessageType('direct');
    }
  }, [replyToMessage, forwardMessage]);

  const handleSend = async () => {
    // For replies, we don't need to check selectedRecipients
    if (!subject.trim() || !body.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Information',
        content: 'Please fill in both subject and message body'
      });
      return;
    }

    // For replies, we have the recipient from the original message
    if (!replyToMessage && selectedRecipients.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Recipients',
        content: 'Please select at least one recipient for your message'
      });
      return;
    }

    if (accessibleTenants.length > 1 && !selectedTenant) {
      showToast({
        type: 'warning',
        title: 'Tenant Required',
        content: 'Please select a tenant for this message'
      });
      return;
    }

    if (accessibleTenants.length > 1 && selectedTenant === 'all') {
      // When "all" is selected, we'll send to all accessible tenants
      // The backend will need to handle this case
    }

    // For replies, we don't need to check recipient count limits
    if (!replyToMessage && selectedRecipients.length > systemSettings.maxRecipients) {
      showToast({
        type: 'warning',
        title: 'Too Many Recipients',
        content: `Maximum ${systemSettings.maxRecipients} recipients allowed`
      });
      return;
    }

    setIsSending(true);
    
    try {
      // Determine the actual tenant ID(s) to send to
      let actualTenantId: string | string[] = selectedTenant;
      if (selectedTenant === 'all') {
        actualTenantId = accessibleTenants;
      }

      // For replies, use the original sender as recipient; otherwise use selectedRecipients
      const messageRecipients = replyToMessage ? [replyToMessage.SenderEmail] : selectedRecipients;
      
      await onSend({
        subject: subject.trim(),
        body: body.trim(),
        recipients: messageRecipients,
        messageType,
        tenantId: actualTenantId
      });
      
      // Show success toast
      showToast({
        type: 'success',
        title: 'Message Sent',
        content: replyToMessage 
          ? 'Reply sent successfully' 
          : `Message sent to ${messageRecipients.length} recipient${messageRecipients.length > 1 ? 's' : ''}`
      });
      
      // Reset form
      setSubject('');
      setBody('');
      setSelectedRecipients([]);
      setMessageType('direct');
      setSelectedTenant(accessibleTenants.length === 1 ? accessibleTenants[0] : '');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error toast
      showToast({
        type: 'error',
        title: 'Send Failed',
        content: 'Failed to send message. Please try again.'
      });
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
              disabled={!subject.trim() || !body.trim() || (!replyToMessage && selectedRecipients.length === 0) || isSending}
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

        {/* Tenant Selection (if multiple tenants) - Hidden for replies */}
        {accessibleTenants.length > 1 && !hideTenantSelection && (
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
        
        {/* Tenant info for replies (when tenant selection is hidden) */}
        {accessibleTenants.length > 1 && hideTenantSelection && replyToMessage && (
          <Box>
            <Text size="2" style={{ marginBottom: '0.5rem' }}>Tenant</Text>
            <Text size="2" color="gray" style={{ padding: '0.5rem', backgroundColor: 'var(--gray-3)', borderRadius: '4px' }}>
              {replyToMessage.TenantId} (automatically set for reply)
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
          {/* For replies, show a simple recipient display instead of selection UI */}
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
                              <Badge size="1" color="red" variant="solid">
                                {recipient.BlockerEmail && recipient.BlockerEmail !== userEmail ? 'ADMIN BLOCKED' : 'USER BLOCKED'}
                              </Badge>
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
            </>
          )}
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
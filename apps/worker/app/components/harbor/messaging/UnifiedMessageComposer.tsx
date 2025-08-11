'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Box, Button, Flex, Heading, Text, TextField, TextArea } from '@radix-ui/themes';
import { FileAttachmentManager } from './FileAttachmentManager';
import { MessageLinkSharing } from './MessageLinkSharing';
import { CreateAttachmentRequest } from '@/types/messaging';

interface UnifiedMessageComposerProps {
  tenantId: string;
  userEmail: string;
  recipients: string[];
  onSend: (message: {
    subject: string;
    body: string;
    recipients: string[];
    attachments: CreateAttachmentRequest[];
    links: Array<{ url: string; title: string; domain: string }>;
  }) => void;
  onCancel?: () => void;
  isSending?: boolean;
  maxRecipients?: number;
  lang: string;
}

export const UnifiedMessageComposer: React.FC<UnifiedMessageComposerProps> = ({
  tenantId,
  userEmail,
  recipients,
  onSend,
  onCancel,
  isSending = false,
  maxRecipients = 10,
  lang
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<Array<{ url: string; title: string; domain: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRecipientToggle = useCallback((email: string) => {
    setSelectedRecipients(prev => 
      prev.includes(email) 
        ? prev.filter(r => r !== email)
        : [...prev, email]
    );
    setError(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!body.trim() && selectedAttachments.length === 0 && selectedLinks.length === 0) {
      setError('Message body, attachments, or links are required');
      return;
    }

    if (selectedRecipients.length === 0) {
      setError('At least one recipient is required');
      return;
    }

    if (selectedRecipients.length > maxRecipients) {
      setError(`Maximum ${maxRecipients} recipients allowed`);
      return;
    }

    setError(null);
    onSend({
      subject: subject.trim(),
      body: body.trim(),
      recipients: selectedRecipients,
      attachments: selectedAttachments,
      links: selectedLinks
    });
  }, [subject, body, selectedRecipients, selectedAttachments, maxRecipients, onSend]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const canSend = subject.trim() && 
    (body.trim() || selectedAttachments.length > 0 || selectedLinks.length > 0) && 
    selectedRecipients.length > 0 && 
    selectedRecipients.length <= maxRecipients;

  return (
    <Box className="unified-message-composer">
      <Flex direction="column" gap="4">
        <Heading size="4">Compose Message</Heading>
        
        {error && (
          <Box p="3" style={{ 
            backgroundColor: 'var(--red-2)', 
            border: '1px solid var(--red-6)', 
            borderRadius: 'var(--radius-3)',
            color: 'var(--red-11)'
          }}>
            <Text size="2">{error}</Text>
          </Box>
        )}

        {/* Subject */}
        <Box>
          <Text size="2" weight="bold" mb="2">Subject</Text>
          <TextField.Root>
            <TextField.Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject..."
              size="3"
            />
          </TextField.Root>
        </Box>

        {/* Recipients */}
        <Box>
          <Text size="2" weight="bold" mb="2">
            Recipients ({selectedRecipients.length}/{maxRecipients})
          </Text>
          
          <Box style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            border: '1px solid var(--gray-6)',
            borderRadius: 'var(--radius-3)',
            padding: '0.5rem'
          }}>
            {recipients.map((email) => (
              <Flex key={email} align="center" gap="2" p="2" style={{
                backgroundColor: selectedRecipients.includes(email) ? 'var(--blue-2)' : 'transparent',
                borderRadius: 'var(--radius-2)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={selectedRecipients.includes(email)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleRecipientToggle(email);
                  }}
                  style={{ 
                    margin: 0,
                    cursor: 'pointer',
                    pointerEvents: 'auto'
                  }}
                />
                <Text 
                  size="2" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRecipientToggle(email)}
                >
                  {email}
                </Text>
              </Flex>
            ))}
          </Box>
        </Box>

        {/* Message Body */}
        <Box>
          <Text size="2" weight="bold" mb="2">Message</Text>
          <Box style={{ minHeight: '120px' }}>
            <TextArea
              name="messageBody"
              placeholder="Type your message here..."
              value={body}
              onChange={(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
              rows={4}
            />
          </Box>
        </Box>

        {/* Attachments */}
        <Box>
          <Text size="2" weight="bold" mb="2">Attachments</Text>
          <FileAttachmentManager
            tenantId={tenantId}
            userEmail={userEmail}
            onAttachmentsChange={setSelectedAttachments}
            maxFiles={5}
            maxFileSize={25 * 1024 * 1024} // 25MB
            allowedTypes={[
              'image/*',
              'application/pdf',
              'text/*',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ]}
            lang={lang}
          />
        </Box>

        {/* Links */}
        <Box>
          <MessageLinkSharing
            links={selectedLinks}
            onLinksChange={setSelectedLinks}
            maxLinks={5}
            disabled={isSending}
            lang={lang}
          />
        </Box>

        {/* Action Buttons */}
        <Flex gap="3" justify="end">
          <Button 
            variant="soft" 
            onClick={handleCancel}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={!canSend || isSending}
          >
            {isSending ? 'Sending...' : 'Send Message'}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};

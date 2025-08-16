'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Button, Flex, Heading, Text, TextField, TextArea, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { FileAttachmentManager } from './FileAttachmentManager';
import { MessageLinkSharing } from './MessageLinkSharing';
import { CreateAttachmentRequest } from '@/types/messaging';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  BlockerEmail?: string;
}

interface UnifiedMessageComposerProps {
  tenantId: string;
  userEmail: string;
  recipients: Recipient[];
  onSend: (message: {
    subject: string;
    body: string;
    recipients: string[];
    attachments: CreateAttachmentRequest[];
    links: Array<{ url: string; title: string; domain: string }>;
    tenantId: string;
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
  const { t } = useTranslation('translations');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<Array<{ url: string; title: string; domain: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipients.length > 0) {
      // Only select the first non-blocked recipient
      const firstNonBlocked = recipients.find(r => !r.IsBlocked);
      if (firstNonBlocked) {
        setSelectedRecipients([firstNonBlocked.Email]);
      } else {
        setSelectedRecipients([]);
      }
    }
  }, [recipients]);

  const handleRecipientToggle = useCallback((email: string) => {
    // Don't allow toggling blocked users
    const recipient = recipients.find(r => r.Email === email);
    if (recipient && recipient.IsBlocked) {
      return;
    }
    
    setSelectedRecipients(prev => 
      prev.includes(email) 
        ? prev.filter(r => r !== email)
        : [...prev, email]
    );
    setError(null);
  }, [recipients]);

  const handleSend = useCallback(() => {
    if (!subject.trim()) {
      setError(t('messaging.subjectRequired'));
      return;
    }

    if (!body.trim() && selectedAttachments.length === 0 && selectedLinks.length === 0) {
      setError(t('messaging.messageBodyRequired'));
      return;
    }

    if (selectedRecipients.length === 0) {
      setError(t('messaging.recipientRequired'));
      return;
    }

    if (selectedRecipients.length > maxRecipients) {
      setError(t('messaging.maxRecipientsExceeded').replace('{max}', maxRecipients.toString()));
      return;
    }

    // Safety check: filter out any blocked users from selectedRecipients
    const validRecipients = selectedRecipients.filter(email => {
      const recipient = recipients.find(r => r.Email === email);
      return recipient && !recipient.IsBlocked;
    });

    if (validRecipients.length === 0) {
      setError(t('messaging.noValidRecipients'));
      return;
    }

    setError(null);
    const messageData = {
      subject: subject.trim(),
      body: body.trim(),
      recipients: validRecipients,
      attachments: selectedAttachments,
      links: selectedLinks,
      tenantId: tenantId
    };
    
    onSend(messageData);
  }, [subject, body, selectedRecipients, selectedAttachments, maxRecipients, tenantId, selectedLinks, recipients]);

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
        <Heading size="4">{t('messaging.composeMessage')}</Heading>
        
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
            {t('messaging.recipients')} ({selectedRecipients.length}/{maxRecipients})
          </Text>
          
          <Box style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            border: '1px solid var(--gray-6)',
            borderRadius: 'var(--radius-3)',
            padding: '0.5rem'
          }}>
            {recipients.map((recipient) => (
              <Flex key={recipient.Email} align="center" gap="2" p="2" style={{
                backgroundColor: selectedRecipients.includes(recipient.Email) ? 'var(--blue-2)' : 'transparent',
                borderRadius: 'var(--radius-2)',
                cursor: recipient.IsBlocked ? 'not-allowed' : 'pointer',
                opacity: recipient.IsBlocked ? 0.6 : 1
              }}>
                <input
                  type="checkbox"
                  checked={selectedRecipients.includes(recipient.Email)}
                  onChange={(e) => {
                    e.stopPropagation();
                    if (!recipient.IsBlocked) {
                      handleRecipientToggle(recipient.Email);
                    }
                  }}
                  disabled={recipient.IsBlocked}
                  style={{ 
                    margin: 0,
                    cursor: recipient.IsBlocked ? 'not-allowed' : 'pointer',
                    pointerEvents: recipient.IsBlocked ? 'none' : 'auto'
                  }}
                />
                <Flex align="center" gap="2" style={{ flex: 1 }}>
                  <Text 
                    size="2" 
                    style={{ 
                      cursor: recipient.IsBlocked ? 'not-allowed' : 'pointer',
                      color: recipient.IsBlocked ? 'var(--gray-9)' : 'inherit'
                    }}
                    onClick={() => {
                      if (!recipient.IsBlocked) {
                        handleRecipientToggle(recipient.Email);
                      }
                    }}
                  >
                    {recipient.Name || recipient.Email}
                  </Text>
                  <Text size="1" color="gray">
                    {recipient.Email}
                  </Text>
                  <Badge size="1" variant="soft">{recipient.TenantId}</Badge>
                  {recipient.IsBlocked ? (
                    <Badge size="1" color="red" variant="solid">
                      {recipient.BlockerEmail === userEmail ? 'USER BLOCKED' : 'ADMIN BLOCKED'}
                    </Badge>
                  ) : recipient.IsOnline ? (
                    <Badge size="1" color="green">Online</Badge>
                  ) : null}
                </Flex>
              </Flex>
            ))}
          </Box>
        </Box>

        {/* Message Body */}
        <Box>
          <Text size="2" weight="bold" mb="2">{t('messaging.message')}</Text>
          <Box style={{ minHeight: '120px' }}>
            <TextArea
              name="messageBody"
              placeholder={t('messaging.typeYourMessage')}
              value={body}
              onChange={(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
              rows={4}
            />
          </Box>
        </Box>

        {/* Attachments */}
        <Box>
          <Text size="2" weight="bold" mb="2">{t('messaging.attachments')}</Text>
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
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSend}
            disabled={!canSend || isSending}
          >
            {isSending ? t('messaging.sending') : t('messaging.send')}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};

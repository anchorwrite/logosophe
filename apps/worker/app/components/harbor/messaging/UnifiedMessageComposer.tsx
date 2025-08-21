'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Button, Flex, Heading, Text, TextField, TextArea, Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { FileAttachmentManager } from './FileAttachmentManager';
import { MessageLinkSharing } from './MessageLinkSharing';
import { TenantSelector } from './TenantSelector';
import { RoleSelector } from './RoleSelector';
import { IndividualRecipientSelector } from './IndividualRecipientSelector';
import { CreateAttachmentRequest } from '@/types/messaging';

interface UserTenant {
  TenantId: string;
  TenantName: string;
  UserRoles: string[];
}

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
  IsOnline: boolean;
  IsBlocked: boolean;
  BlockerEmail?: string;
}

interface UnifiedMessageComposerProps {
  userTenants: UserTenant[];
  userEmail: string;
  recipients: Recipient[];
  roles: Role[];
  onSend: (message: {
    subject: string;
    body: string;
    tenants: string[];
    roles: string[];
    individualRecipients: string[];
    attachments: CreateAttachmentRequest[];
    links: Array<{ url: string; title: string; domain: string }>;
  }) => void;
  onCancel?: () => void;
  isSending?: boolean;
  maxRecipients?: number;
  lang: string;
}

export const UnifiedMessageComposer: React.FC<UnifiedMessageComposerProps> = ({
  userTenants,
  userEmail,
  recipients,
  roles,
  onSend,
  onCancel,
  isSending = false,
  maxRecipients = 50, // Increased for role-based messaging
  lang
}) => {
  const { t } = useTranslation('translations');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedIndividualRecipients, setSelectedIndividualRecipients] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<Array<{ url: string; title: string; domain: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Calculate total recipients
  const totalRecipients = React.useMemo(() => {
    let count = 0;
    
    // Count role-based recipients
    if (selectedRoles.length > 0 && selectedTenants.length > 0) {
      count += recipients.filter(r => 
        selectedTenants.includes(r.TenantId) && 
        selectedRoles.includes(r.RoleId)
      ).length;
    }
    
    // Add individual recipients
    count += selectedIndividualRecipients.length;
    
    return count;
  }, [selectedTenants, selectedRoles, selectedIndividualRecipients, recipients]);

  // Auto-select user's first tenant if available
  useEffect(() => {
    if (userTenants.length > 0 && selectedTenants.length === 0) {
      setSelectedTenants([userTenants[0].TenantId]);
    }
  }, [userTenants, selectedTenants]);

  const handleSend = useCallback(() => {
    if (!subject.trim()) {
      setError(t('messaging.subjectRequired'));
      return;
    }

    if (!body.trim() && selectedAttachments.length === 0 && selectedLinks.length === 0) {
      setError(t('messaging.messageBodyRequired'));
      return;
    }

    if (selectedTenants.length === 0) {
      setError(t('messaging.tenantRequired'));
      return;
    }

    if (selectedRoles.length === 0 && selectedIndividualRecipients.length === 0) {
      setError(t('messaging.recipientRequired'));
      return;
    }

    if (totalRecipients > maxRecipients) {
      setError(t('messaging.maxRecipientsExceeded', { max: maxRecipients }));
      return;
    }

    // Prepare message data with tenant and role information
    const messageData = {
      subject,
      body,
      tenants: selectedTenants,
      roles: selectedRoles,
      individualRecipients: selectedIndividualRecipients,
      attachments: selectedAttachments,
      links: selectedLinks
    };

    onSend(messageData);
  }, [subject, body, selectedTenants, selectedRoles, selectedIndividualRecipients, selectedAttachments, selectedLinks, totalRecipients, maxRecipients, onSend, t]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <Box style={{ padding: '1.5rem', border: '1px solid var(--gray-6)', borderRadius: 'var(--radius-3)' }}>
      <Heading size="4" style={{ marginBottom: '1.5rem' }}>
        {t('messaging.composeMessage')}
      </Heading>

      {/* Tenant Selection */}
      <Box style={{ marginBottom: '2rem' }}>
        <TenantSelector
          userTenants={userTenants}
          selectedTenants={selectedTenants}
          onTenantChange={setSelectedTenants}
        />
      </Box>

      {/* Role Selection */}
      {selectedTenants.length > 0 && (
        <Box style={{ marginBottom: '2rem' }}>
          <RoleSelector
            roles={roles}
            recipients={recipients}
            selectedRoles={selectedRoles}
            onRoleChange={setSelectedRoles}
          />
        </Box>
      )}

      {/* Individual Recipient Selection */}
      {selectedTenants.length > 0 && (
        <Box style={{ marginBottom: '2rem' }}>
          <IndividualRecipientSelector
            recipients={recipients.filter(r => selectedTenants.includes(r.TenantId))}
            selectedRecipients={selectedIndividualRecipients}
            onRecipientChange={setSelectedIndividualRecipients}
          />
        </Box>
      )}

      {/* Recipient Summary */}
      {totalRecipients > 0 && (
        <Box style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          backgroundColor: 'var(--gray-2)', 
          borderRadius: 'var(--radius-2)' 
        }}>
          <Text weight="bold" size="3">
            {t('messaging.totalRecipients')}: {totalRecipients} {t('messaging.users')}
          </Text>
          <Text size="2" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
            {t('messaging.acrossTenants')} {selectedTenants.length} {t('messaging.tenant')}(s)
          </Text>
        </Box>
      )}

      {/* Message Composition Fields */}
      <Box style={{ marginBottom: '1.5rem' }}>
        <Text weight="bold" style={{ marginBottom: '0.5rem', display: 'block' }}>
          {t('messaging.subject')} *
        </Text>
        <TextField.Root style={{ width: '100%' }}>
          <TextField.Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('messaging.subjectPlaceholder')}
          />
        </TextField.Root>
      </Box>

      <Box style={{ marginBottom: '1.5rem' }}>
        <Text weight="bold" style={{ marginBottom: '0.5rem', display: 'block' }}>
          {t('messaging.message')} *
        </Text>
        <TextArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('messaging.messagePlaceholder')}
          style={{ width: '100%', minHeight: '120px' }}
        />
      </Box>

      {/* File Attachments */}
      <Box style={{ marginBottom: '1.5rem' }}>
        <FileAttachmentManager
          tenantId={selectedTenants[0] || ''}
          userEmail={userEmail}
          onAttachmentsChange={setSelectedAttachments}
          lang={lang}
        />
      </Box>

      {/* Link Sharing */}
      <Box style={{ marginBottom: '1.5rem' }}>
        <MessageLinkSharing
          links={selectedLinks}
          onLinksChange={setSelectedLinks}
          lang={lang}
        />
      </Box>

      {/* Error Display */}
      {error && (
        <Box style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          backgroundColor: 'var(--red-2)', 
          color: 'var(--red-11)',
          borderRadius: 'var(--radius-2)'
        }}>
          <Text>{error}</Text>
        </Box>
      )}

      {/* Action Buttons */}
      <Flex gap="2" justify="end">
        <Button variant="soft" onClick={handleCancel}>
          {t('messaging.cancel')}
        </Button>
        <Button 
          onClick={handleSend} 
          disabled={isSending || totalRecipients === 0}
        >
          {isSending ? t('common.status.sending') : t('messaging.sendMessage')}
        </Button>
      </Flex>
    </Box>
  );
};

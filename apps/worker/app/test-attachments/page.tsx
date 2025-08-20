'use client';

import React, { useState } from 'react';
import { Box, Flex, Heading, Text, Button, Card } from '@radix-ui/themes';
import { FileAttachmentManager } from '../components/harbor/messaging/FileAttachmentManager';
import { MessageLinkSharing } from '../components/harbor/messaging/MessageLinkSharing';
import { UnifiedMessageComposer } from '../components/harbor/messaging/UnifiedMessageComposer';
import { CreateAttachmentRequest } from '@/types/messaging';

export default function TestAttachmentsPage() {
  const [attachments, setAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [links, setLinks] = useState<Array<{ url: string; title: string; domain: string }>>([]);
  const [composerData, setComposerData] = useState<any>(null);

  const handleComposerSend = (data: any) => {
    setComposerData(data);
    console.log('Composer data:', data);
  };

  return (
    <Box p="6">
      <Heading size="6" mb="4">File Attachment System Test</Heading>
      
      <Flex direction="column" gap="6">
        {/* File Attachment Manager Test */}
        <Card size="3">
          <Heading size="4" mb="3">File Attachment Manager</Heading>
          <FileAttachmentManager
            tenantId="test-tenant"
            userEmail="test@example.com"
            onAttachmentsChange={setAttachments}
            maxFiles={5}
            maxFileSize={25 * 1024 * 1024}
            allowedTypes={[
              'image/*',
              'application/pdf',
              'text/*',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]}
            lang="en"
          />
          <Box mt="3">
            <Text size="2" weight="bold">Current Attachments:</Text>
            <pre style={{ fontSize: '12px', backgroundColor: 'var(--gray-2)', padding: '8px', borderRadius: '4px' }}>
              {JSON.stringify(attachments, null, 2)}
            </pre>
          </Box>
        </Card>

        {/* Link Sharing Test */}
        <Card size="3">
          <Heading size="4" mb="3">Link Sharing</Heading>
          <MessageLinkSharing
            links={links}
            onLinksChange={setLinks}
            maxLinks={5}
            lang="en"
          />
          <Box mt="3">
            <Text size="2" weight="bold">Current Links:</Text>
            <pre style={{ fontSize: '12px', backgroundColor: 'var(--gray-2)', padding: '8px', borderRadius: '4px' }}>
              {JSON.stringify(links, null, 2)}
            </pre>
          </Box>
        </Card>

        {/* Unified Message Composer Test */}
        <Card size="3">
          <Heading size="4" mb="3">Unified Message Composer</Heading>
          <UnifiedMessageComposer
            userTenants={[{ TenantId: 'test-tenant', TenantName: 'Test Tenant', UserRoles: ['subscriber'] }]}
            userEmail="test@example.com"
            recipients={[
              { Email: 'user1@example.com', Name: 'User 1', TenantId: 'test-tenant', TenantName: 'Test Tenant', RoleId: 'subscriber', IsOnline: false, IsBlocked: false },
              { Email: 'user2@example.com', Name: 'User 2', TenantId: 'test-tenant', TenantName: 'Test Tenant', RoleId: 'subscriber', IsOnline: false, IsBlocked: false },
              { Email: 'user3@example.com', Name: 'User 3', TenantId: 'test-tenant', TenantName: 'Test Tenant', RoleId: 'subscriber', IsOnline: false, IsBlocked: false }
            ]}
            roles={[{ RoleId: 'subscriber', UserCount: 3 }]}
            onSend={handleComposerSend}
            onCancel={() => console.log('Composer cancelled')}
            maxRecipients={5}
            lang="en"
          />
        </Card>

        {/* Results Display */}
        {composerData && (
          <Card size="3">
            <Heading size="4" mb="3">Composer Results</Heading>
            <pre style={{ fontSize: '12px', backgroundColor: 'var(--gray-2)', padding: '8px', borderRadius: '4px' }}>
              {JSON.stringify(composerData, null, 2)}
            </pre>
          </Card>
        )}
      </Flex>
    </Box>
  );
}

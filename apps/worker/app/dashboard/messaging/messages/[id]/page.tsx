import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { Container, Heading, Text, Flex, Card, Button, Box, Badge, Separator } from '@radix-ui/themes';
import Link from 'next/link';
import type { D1Result } from '@cloudflare/workers-types';

interface Message {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  TenantId: string;
  MessageType: string;
  Priority: string;
  CreatedAt: string;
  IsDeleted: boolean;
  IsRecalled: boolean;
  HasAttachments: boolean;
  AttachmentCount: number;
}

interface MessageRecipient {
  Email: string;
  Name: string;
  IsRead: boolean;
  ReadAt: string | null;
  IsDeleted: boolean;
}

interface MessageAttachment {
  Id: number;
  FileName: string;
  FileSize: number;
  ContentType: string;
  AttachmentType: string;
  CreatedAt: string;
}

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  const { id } = await params;
  const messageId = parseInt(id);
  if (isNaN(messageId)) {
    redirect('/dashboard/messaging/messages');
  }

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const accessibleTenants = await getUserMessagingTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    redirect('/dashboard/messaging');
  }

  // Log access
  await normalizedLogging.logMessagingOperations({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_message_detail',
    accessType: 'read',
    targetId: id,
    targetName: `Message ${id}`,
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { messageId: id }
  });

  // Fetch message details
  let messageQuery = '';
  let queryParams: any[] = [];

  if (isAdmin) {
    // System admins can see all messages
    messageQuery = `
      SELECT * FROM Messages WHERE Id = ? AND IsDeleted = FALSE
    `;
    queryParams = [messageId];
  } else {
    // Tenant admins can only see messages from their tenants
    messageQuery = `
      SELECT * FROM Messages 
      WHERE Id = ? AND IsDeleted = FALSE 
      AND TenantId IN (${accessibleTenants.map(() => '?').join(',')})
    `;
    queryParams = [messageId, ...accessibleTenants];
  }

  const messageResult = await db.prepare(messageQuery).bind(...queryParams).first() as Message | undefined;
  
  if (!messageResult) {
    redirect('/dashboard/messaging/messages');
  }

  // Get message recipients
  const recipientsQuery = `
    SELECT 
      mr.RecipientEmail,
      s.Name,
      mr.IsRead,
      mr.ReadAt,
      mr.IsDeleted
    FROM MessageRecipients mr
    LEFT JOIN Subscribers s ON mr.RecipientEmail = s.Email
    WHERE mr.MessageId = ?
    ORDER BY mr.RecipientEmail
  `;

  const recipientsResult = await db.prepare(recipientsQuery).bind(messageId).all() as D1Result<MessageRecipient>;
  const recipients = recipientsResult.results || [];

  // Get message attachments if any
  let attachments: MessageAttachment[] = [];
  if (messageResult.HasAttachments) {
    const attachmentsQuery = `
      SELECT 
        ma.Id,
        ma.FileName,
        ma.FileSize,
        ma.ContentType,
        ma.AttachmentType,
        ma.CreatedAt
      FROM MessageAttachments ma
      WHERE ma.MessageId = ?
      ORDER BY ma.CreatedAt
    `;

    const attachmentsResult = await db.prepare(attachmentsQuery).bind(messageId).all() as D1Result<MessageAttachment>;
    attachments = attachmentsResult.results || [];
  }

  // Get sender name
  const senderQuery = `
    SELECT Name FROM Subscribers WHERE Email = ?
  `;
  const senderResult = await db.prepare(senderQuery).bind(messageResult.SenderEmail).first() as { Name: string } | undefined;
  const senderName = senderResult?.Name || messageResult.SenderEmail;

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Message Details
            </Heading>
            <Text color="gray" size="3">
              View detailed information about message #{messageId}
            </Text>
          </Box>
          <Flex gap="2">
            <Button variant="soft" asChild>
              <Link href="/dashboard/messaging/messages">Back to Messages</Link>
            </Button>
            <Button variant="soft" asChild>
              <Link href="/dashboard/messaging/interface">Compose New Message</Link>
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Message Header */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            {messageResult.Subject}
          </Heading>
          
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Box>
                <Text size="2" color="gray">From</Text>
                <Text weight="medium">{senderName} ({messageResult.SenderEmail})</Text>
              </Box>
              <Box>
                <Text size="2" color="gray">Date</Text>
                <Text>{new Date(messageResult.CreatedAt).toLocaleString()}</Text>
              </Box>
            </Flex>
            
            <Flex gap="4" wrap="wrap">
              <Box>
                <Text size="2" color="gray">Type</Text>
                <Badge variant="soft">{messageResult.MessageType}</Badge>
              </Box>
              <Box>
                <Text size="2" color="gray">Priority</Text>
                <Badge variant="soft" color={messageResult.Priority === 'high' ? 'red' : 'gray'}>
                  {messageResult.Priority}
                </Badge>
              </Box>
              <Box>
                <Text size="2" color="gray">Tenant</Text>
                <Badge variant="soft">{messageResult.TenantId}</Badge>
              </Box>
              {messageResult.HasAttachments && (
                <Box>
                  <Text size="2" color="gray">Attachments</Text>
                  <Badge variant="soft">{messageResult.AttachmentCount}</Badge>
                </Box>
              )}
            </Flex>

            {messageResult.IsRecalled && (
              <Box style={{ 
                padding: '0.75rem', 
                backgroundColor: 'var(--red-3)', 
                borderRadius: '4px',
                border: '1px solid var(--red-6)'
              }}>
                <Text color="red" size="2" weight="medium">
                  ⚠️ This message has been recalled by the sender
                </Text>
              </Box>
            )}
          </Flex>
        </Box>
      </Card>

      {/* Message Body */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>Message Content</Heading>
          <Box style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--gray-2)', 
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6'
          }}>
            {messageResult.Body}
          </Box>
        </Box>
      </Card>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card style={{ marginBottom: '2rem' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Attachments</Heading>
            <Flex direction="column" gap="2">
              {attachments.map((attachment) => (
                <Flex key={attachment.Id} justify="between" align="center" style={{
                  padding: '0.75rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px'
                }}>
                  <Box>
                    <Text weight="medium" size="2">{attachment.FileName}</Text>
                    <Text size="1" color="gray">
                      {attachment.ContentType} • {(attachment.FileSize / 1024).toFixed(1)} KB
                    </Text>
                  </Box>
                  <Badge variant="soft" size="1">{attachment.AttachmentType}</Badge>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      )}

      {/* Recipients */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Recipients ({recipients.filter(r => !r.IsDeleted).length})
          </Heading>
          
          {recipients.length === 0 ? (
            <Text color="gray">No recipients found</Text>
          ) : (
            <Flex direction="column" gap="2">
              {recipients.map((recipient) => (
                <Flex key={recipient.Email} justify="between" align="center" style={{
                  padding: '0.75rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  opacity: recipient.IsDeleted ? 0.6 : 1
                }}>
                  <Box>
                    <Text weight="medium" size="2">
                      {recipient.Name || 'Unknown User'}
                    </Text>
                    <Text size="1" color="gray">{recipient.Email}</Text>
                  </Box>
                  <Flex gap="2" align="center">
                    {recipient.IsDeleted ? (
                      <Badge size="1" color="gray">Deleted</Badge>
                    ) : recipient.IsRead ? (
                      <Badge size="1" color="green">
                        Read {recipient.ReadAt ? new Date(recipient.ReadAt).toLocaleString() : ''}
                      </Badge>
                    ) : (
                      <Badge size="1" color="red">Unread</Badge>
                    )}
                  </Flex>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      </Card>

      {/* Message Actions */}
      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>Actions</Heading>
          <Flex gap="2" wrap="wrap">
            <Button variant="soft" asChild>
              <Link href={`/dashboard/messaging/interface?reply=${messageId}`}>
                Reply to Message
              </Link>
            </Button>
            <Button variant="soft" asChild>
              <Link href="/dashboard/messaging/interface">
                Compose New Message
              </Link>
            </Button>
            <Button variant="soft" asChild>
              <Link href="/dashboard/messaging/messages">
                Back to Messages
              </Link>
            </Button>
          </Flex>
        </Box>
      </Card>
    </Container>
  );
}

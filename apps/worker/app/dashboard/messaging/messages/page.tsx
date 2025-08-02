import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Flex, Card, Button, Box, Table, Badge } from '@radix-ui/themes';
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
  RecipientCount: number;
  ReadCount: number;
}

export default async function MessagesPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const accessibleTenants = await getUserMessagingTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    redirect('/dashboard/messaging');
  }

  // Log access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_MESSAGE_MANAGEMENT'
  });

  // Fetch messages based on user's access level
  let messagesQuery = '';
  let params: any[] = [];

  if (isAdmin) {
    // System admins can see all messages
    messagesQuery = `
      SELECT 
        m.*,
        COUNT(DISTINCT mr.RecipientEmail) as RecipientCount,
        COUNT(DISTINCT CASE WHEN mr.IsRead = TRUE THEN mr.RecipientEmail END) as ReadCount
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.IsDeleted = FALSE
      GROUP BY m.Id
      ORDER BY m.CreatedAt DESC
      LIMIT 50
    `;
  } else {
    // Tenant admins can only see messages from their tenants
    messagesQuery = `
      SELECT 
        m.*,
        COUNT(DISTINCT mr.RecipientEmail) as RecipientCount,
        COUNT(DISTINCT CASE WHEN mr.IsRead = TRUE THEN mr.RecipientEmail END) as ReadCount
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.IsDeleted = FALSE
      AND m.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      GROUP BY m.Id
      ORDER BY m.CreatedAt DESC
      LIMIT 50
    `;
    params = accessibleTenants;
  }

  const messagesResult = await db.prepare(messagesQuery).bind(...params).all() as D1Result<Message>;
  const messages = messagesResult.results || [];

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Message Management
            </Heading>
            <Text color="gray" size="3">
              View and manage all messages in the system
            </Text>
          </Box>
          <Button asChild>
            <Link href="/dashboard/messaging/interface">
              Compose New Message
            </Link>
          </Button>
        </Flex>
      </Box>

      {/* Search and Filters */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Search & Filters
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Search Messages</Text>
              <input
                type="text"
                placeholder="Search by subject, sender, or content..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Message Type</Text>
              <select
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Types</option>
                <option value="direct">Direct</option>
                <option value="broadcast">Broadcast</option>
                <option value="announcement">Announcement</option>
              </select>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Status</Text>
              <select
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Status</option>
                <option value="read">Read</option>
                <option value="unread">Unread</option>
                <option value="recalled">Recalled</option>
              </select>
            </Box>
            <Box style={{ display: 'flex', alignItems: 'end' }}>
              <Button>Search</Button>
            </Box>
          </Flex>
        </Box>
      </Card>

      {/* Messages Table */}
      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Recent Messages ({messages.length})
          </Heading>
          
          {messages.length === 0 ? (
            <Box style={{ textAlign: 'center', padding: '2rem' }}>
              <Text color="gray">No messages found</Text>
            </Box>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Subject</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Sender</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Recipients</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {messages.map((message) => (
                  <Table.Row key={message.Id}>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium" style={{ marginBottom: '0.25rem' }}>
                          {message.Subject}
                        </Text>
                        <Text size="2" color="gray" style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {message.Body}
                        </Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{message.SenderEmail}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={message.MessageType === 'broadcast' ? 'solid' : 'soft'}>
                        {message.MessageType}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">
                        {message.ReadCount}/{message.RecipientCount} read
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {message.IsRecalled ? (
                        <Badge color="red">Recalled</Badge>
                      ) : (
                        <Badge color="green">Active</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">
                        {new Date(message.CreatedAt).toLocaleDateString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <Button size="1" variant="soft" asChild>
                          <Link href={`/dashboard/messaging/messages/${message.Id}`}>
                            View
                          </Link>
                        </Button>
                        {message.IsRecalled && (
                          <Button size="1" variant="soft" color="red">
                            Delete
                          </Button>
                        )}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Card>
    </Container>
  );
} 
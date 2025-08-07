import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Container, Heading, Text, Box, Flex, Button, Card, Badge, Table } from '@radix-ui/themes';
import Link from 'next/link';
import type { Locale } from '@/types/i18n';
import { getDictionary } from '@/lib/dictionary';
import { InvitationActions } from '@/components/harbor/workflow/InvitationActions';

interface WorkflowInvitation {
  id: string;
  workflowId: string;
  workflowTitle: string;
  workflowStatus: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: string;
  status: string;
  message: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
}

type Params = Promise<{ lang: Locale }>;

export default async function InvitationsPage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;

  // Get user's invitations
  const invitationsQuery = `
    SELECT 
      wi.Id,
      wi.WorkflowId,
      wi.InviterEmail,
      wi.InviteeEmail,
      wi.Role,
      wi.Status,
      wi.Message,
      wi.ExpiresAt,
      wi.CreatedAt,
      wi.UpdatedAt,
      w.Title as WorkflowTitle,
      w.Status as WorkflowStatus,
      w.TenantId
    FROM WorkflowInvitations wi
    JOIN Workflows w ON wi.WorkflowId = w.Id
    WHERE wi.InviteeEmail = ?
    ORDER BY wi.CreatedAt DESC
  `;

  const invitations = await db.prepare(invitationsQuery)
    .bind(session.user.email)
    .all() as any;

  // Filter out expired invitations
  const now = new Date();
  const validInvitations = invitations.results?.filter((invitation: any) => {
    return new Date(invitation.ExpiresAt) > now;
  }) || [];

  const formattedInvitations: WorkflowInvitation[] = validInvitations.map((invitation: any) => ({
    id: invitation.Id,
    workflowId: invitation.WorkflowId,
    workflowTitle: invitation.WorkflowTitle,
    workflowStatus: invitation.WorkflowStatus,
    inviterEmail: invitation.InviterEmail,
    inviteeEmail: invitation.InviteeEmail,
    role: invitation.Role,
    status: invitation.Status,
    message: invitation.Message,
    expiresAt: invitation.ExpiresAt,
    createdAt: invitation.CreatedAt,
    updatedAt: invitation.UpdatedAt,
    isExpired: new Date(invitation.ExpiresAt) <= now
  }));

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              My Workflow Invitations
            </Heading>
            <Text color="gray" size="3">
              View and respond to workflow invitations
            </Text>
          </Box>
          <Flex gap="2">
            <Button variant="soft" asChild>
              <Link href={`/${lang}/harbor/workflow`}>
                ← Back to Workflows
              </Link>
            </Button>
          </Flex>
        </Flex>
      </Box>

      <Card>
        <Box p="4">
          <Heading size="4" mb="4">My Workflow Invitations</Heading>

          {formattedInvitations.length === 0 ? (
            <Text color="gray">No pending invitations</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Workflow</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Invited By</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {formattedInvitations.map((invitation) => (
                  <Table.Row key={invitation.id}>
                    <Table.Cell>
                      <Text weight="medium">{invitation.workflowTitle}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{invitation.inviterEmail}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{invitation.role}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={invitation.status === 'pending' ? 'orange' : invitation.status === 'accepted' ? 'green' : 'red'}>
                        {invitation.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color={invitation.isExpired ? 'red' : 'gray'}>
                        {invitation.isExpired ? 'Expired' : 'Active'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <InvitationActions 
                        invitationId={invitation.id}
                        status={invitation.status}
                        isExpired={invitation.isExpired}
                      />
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

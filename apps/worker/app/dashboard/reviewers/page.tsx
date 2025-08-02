import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Container, Box, Card, Text, Heading } from '@radix-ui/themes';
import { DataTable } from '@/components/table';
import type { TableConfig } from '@/types/table';
import { getUserTenants } from '@/lib/access';
import { TenantSelector } from '@/components/TenantSelector';
import { headers } from 'next/headers';

export const runtime = 'edge';

const reviewerConfig: TableConfig = {
  name: 'Reviewers',
  endpoint: '/api/reviewers',
  fields: [
    { name: 'Email', label: 'Email', type: 'text', required: true },
    { name: 'Name', label: 'Name', type: 'text', required: true },
    { name: 'TenantName', label: 'Tenant', type: 'text', required: true, readOnly: true },
    { name: 'AssignedAt', label: 'Assigned At', type: 'datetime', required: false, readOnly: true }
  ]
};

export default async function ReviewersPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Get user's accessible tenants
  const tenants = await getUserTenants(session.user.email);
  if (!tenants.length) {
    redirect('/harbor');
  }

  // Get current tenant from URL or default to first tenant
  const headersList = await headers();
  const url = new URL(headersList.get('x-url') || '/');
  const currentTenantId = url.searchParams.get('tenantId') || tenants[0].Id;

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6">
          <Heading size="6" align="center">Reviewers</Heading>
        </Box>

        {tenants.length > 1 && (
          <Box mb="6">
            <TenantSelector 
              tenants={tenants} 
              currentTenantId={currentTenantId} 
            />
          </Box>
        )}

        <Card>
          <Box p="4">
            <Text size="5" weight="bold" align="center" style={{ display: 'block', marginBottom: '1rem' }}>
              Reviewer Management
            </Text>
            <DataTable 
              config={reviewerConfig}
              defaultTenantId={tenants[0].Id}
            />
          </Box>
        </Card>
      </Box>
    </Container>
  );
} 
import { Container, Box, Heading, Text } from '@radix-ui/themes';
import { checkAccess } from '@/lib/access-control';
import { LogsTable } from './LogsTable';
import { LogRetentionManager } from './LogRetentionManager';


export default async function LogsPage() {
    const access = await checkAccess({
        requireAuth: true,
        allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess) {
        return new Response('Unauthorized', { status: 401 });
    }

    return (
        <Container>
            <Box py="6">
                <Heading mb="4">System Logs</Heading>
                <LogRetentionManager />
                <LogsTable />
            </Box>
        </Container>
    );
} 
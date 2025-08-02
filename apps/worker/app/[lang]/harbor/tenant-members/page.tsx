import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAccess } from "@/lib/access-control";
import { Card, Box, Heading, Flex, Button } from "@radix-ui/themes";
import TenantMembers from "@/components/TenantMembers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";


export default async function TenantMembersPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Check if user has any roles
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'editor', 'author', 'subscriber', 'agent', 'reviewer', 'user']
  });

  if (!access.hasAccess) {
    return (
      <Flex direction="column" align="center" gap="4">
        <Box p="4">
          <Heading size="5" align="center">Access Denied</Heading>
          <p className="text-gray-600 text-center">You need at least one role to access this page.</p>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="center" gap="4">
      <Box p="4" style={{ width: '100%', maxWidth: '64rem' }}>
        <Flex justify="between" align="center" mb="4">
          <Link href="/harbor">
            <Button variant="ghost">
              <ArrowLeft className="mr-2" />
              Back to Harbor
            </Button>
          </Link>
          <Heading size="5">Tenant Members</Heading>
          <Box style={{ width: 100 }} /> {/* Spacer for alignment */}
        </Flex>
        <Card size="3">
          <Box p="4">
            <TenantMembers />
          </Box>
        </Card>
      </Box>
    </Flex>
  );
} 
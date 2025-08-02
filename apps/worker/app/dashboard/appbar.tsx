import { auth } from "@/auth";
import Link from "next/link";
import React from "react";
import { SvgIcon } from "@/common/SvgIcon";
import { Button, Flex, Box } from "@radix-ui/themes";
import { PreferencesButton } from "@/components/PreferencesButton";
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export default async function DashboardAppBar() {
  const session = await auth();
  
  // Check if user is a system admin
  let isGlobalAdmin = false;
  if (session?.user?.email) {
    try {
      const { env } = await getCloudflareContext({async: true});
      isGlobalAdmin = await isSystemAdmin(session.user.email, env.DB);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  }

  return (
    <Flex justify="between" align="center" style={{ width: '100%' }}>
      <Link href="/" aria-label="homepage">
        <Box style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '-8px', zIndex: 10 }}>
          <SvgIcon src="/img/svg/logo.svg" width="101px" height="64px" />
        </Box>
      </Link>
      {session?.user ? (
        <Flex gap="4" align="center" p="2">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/profile">
              Profile
            </Link>
          </Button>
          <PreferencesButton />
          <Button variant="ghost" asChild>
            <Link href="/signout">
              Sign Out
            </Link>
          </Button>
        </Flex>
      ) : null}
    </Flex>
  );
} 
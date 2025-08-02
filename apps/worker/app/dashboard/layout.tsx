import { Metadata } from "next";
import DashboardAppBar from "./appbar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { handleAccessControl } from '@/lib/access-control';
import { Container, Box, Flex } from '@radix-ui/themes';
import ScrollRestoration from '@/components/ScrollRestoration';

// These styles apply to every route in the application
import '@/globals.css'

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard for Logosophe",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only admin and tenant users can access the dashboard
  await handleAccessControl({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant']
  });

  return (
    <>
      <ScrollRestoration />
      <Flex direction="column" style={{ minHeight: '100vh' }}>
        <Box asChild style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 50, 
          width: '100%', 
          borderBottom: '1px solid var(--gray-6)',
          backgroundColor: 'var(--color-panel-solid)',
          backdropFilter: 'blur(8px)'
        }}>
          <header>
            <Container size="3">
              <Box style={{ height: '3.5rem', display: 'flex', alignItems: 'center' }}>
                <DashboardAppBar />
              </Box>
            </Container>
          </header>
        </Box>
        <Box asChild grow="1">
          <main>
            <Container size="3" style={{ padding: '1.5rem 0' }}>
              {children}
            </Container>
          </main>
        </Box>
      </Flex>
    </>
  );
}

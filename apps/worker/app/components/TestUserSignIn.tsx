'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { Box, Button, Flex, Heading, Text, ScrollArea } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

interface TestSession {
  id: number;
  sessionToken: string;
  testUserEmail: string;
  createdBy: string;
  createdAt: string;
  lastAccessed: string | null;
  ipAddress: string;
  userAgent: string;
  sessionUrl: string;
}

interface SessionsResponse {
  success: boolean;
  sessions: TestSession[];
  sessionCount: number;
  maxSessions: number;
}

export default function TestUserSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState<string | null>(null);
  const [lastCreatedSession, setLastCreatedSession] = useState<{ email: string; url: string } | null>(null);
  const [activeSessions, setActiveSessions] = useState<TestSession[]>([]);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { showToast } = useToast();

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/test-sessions/list');
      if (response.ok) {
        const data: SessionsResponse = await response.json();
        setActiveSessions(data.sessions);
      }
    } catch {
      // Silently handle error
    }
  };

  useEffect(() => {
    fetchActiveSessions();
  }, [sessionsRefreshKey]);

  const createTestSession = async (testUserEmail: string) => {
    try {
      setCreatingSession(testUserEmail);

      const response = await fetch('/api/test-sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testUserEmail }),
      });

      if (!response.ok) {
        const error = await response.json() as { error: string };
        throw new Error(error.error || 'Failed to create session');
      }

      const data = await response.json() as { sessionUrl: string };

      setLastCreatedSession({ email: testUserEmail, url: data.sessionUrl });
      await navigator.clipboard.writeText(data.sessionUrl);

      setTimeout(async () => {
        await fetchActiveSessions();
        setSessionsRefreshKey(prev => prev + 1);
      }, 100);

      showToast({
        type: 'success',
        title: 'Session Created',
        content: `Session URL for ${testUserEmail} copied to clipboard`
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to create session'
      });
    } finally {
      setCreatingSession(null);
    }
  };

  const handleQuickAction = async (userNumber: number) => {
    const testEmail = `test-user-${userNumber}@logosophe.test`;
    const existingSession = activeSessions.find(s => s.testUserEmail === testEmail);

    if (existingSession) {
      try {
        const response = await fetch(`/api/test-sessions/${existingSession.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showToast({
            type: 'success',
            title: 'Session Terminated',
            content: `Session for ${testEmail} has been terminated`
          });
          await fetchActiveSessions();
          window.dispatchEvent(new CustomEvent('test-session-updated'));
          setSessionsRefreshKey(prev => prev + 1);
        } else {
          const error = await response.json() as { error: string };
          showToast({ type: 'error', title: 'Error', content: error.error || 'Failed to terminate session' });
        }
      } catch {
        showToast({ type: 'error', title: 'Error', content: 'Failed to terminate session' });
      }
    } else {
      await createTestSession(testEmail);
    }
  };

  const hasActiveSession = (userNumber: number) => {
    const testEmail = `test-user-${userNumber}@logosophe.test`;
    return activeSessions.some(s => s.testUserEmail === testEmail);
  };

  const testUsers = [
    { number: 201, label: 'Test User 201 (Signed)', category: 'Signed' },
    { number: 202, label: 'Test User 202 (Signed)', category: 'Signed' },
    { number: 203, label: 'Test User 203 (Signed)', category: 'Signed' },
    { number: 204, label: 'Test User 204 (Signed)', category: 'Signed' },
    { number: 205, label: 'Test User 205 (Signed)', category: 'Signed' },
    { number: 301, label: 'Test User 301 (Opted In)', category: 'Opted In' },
    { number: 302, label: 'Test User 302 (Opted In)', category: 'Opted In' },
    { number: 303, label: 'Test User 303 (Opted In)', category: 'Opted In' },
    { number: 304, label: 'Test User 304 (Opted In)', category: 'Opted In' },
    { number: 305, label: 'Test User 305 (Opted In)', category: 'Opted In' },
    { number: 411, label: 'Test User 411 (Tenant 1 - Author)', category: 'Tenant' },
    { number: 412, label: 'Test User 412 (Tenant 1 - Agent)', category: 'Tenant' },
    { number: 413, label: 'Test User 413 (Tenant 1 - Reviewer)', category: 'Tenant' },
    { number: 414, label: 'Test User 414 (Tenant 1 - Editor)', category: 'Tenant' },
    { number: 415, label: 'Test User 415 (Tenant 1 - Author+Reviewer)', category: 'Tenant' },
    { number: 421, label: 'Test User 421 (Tenant 2 - Agent+Reviewer)', category: 'Tenant' },
    { number: 422, label: 'Test User 422 (Tenant 2 - Author+Editor)', category: 'Tenant' },
    { number: 423, label: 'Test User 423 (Tenant 2 - Agent+Editor)', category: 'Tenant' },
    { number: 424, label: 'Test User 424 (Tenant 2 - Reviewer+Editor)', category: 'Tenant' },
    { number: 425, label: 'Test User 425 (Tenant 2 - Author+Agent)', category: 'Tenant' },
    { number: 431, label: 'Test User 431 (Tenant 3 - Agent)', category: 'Tenant' },
    { number: 432, label: 'Test User 432 (Tenant 3 - Reviewer)', category: 'Tenant' },
    { number: 433, label: 'Test User 433 (Tenant 3 - Author+Editor)', category: 'Tenant' },
    { number: 434, label: 'Test User 434 (Tenant 3 - Agent+Editor)', category: 'Tenant' },
    { number: 435, label: 'Test User 435 (Tenant 3 - Reviewer+Editor)', category: 'Tenant' },
    { number: 441, label: 'Test User 441 (Tenant 4 - Author+Agent)', category: 'Tenant' },
    { number: 442, label: 'Test User 442 (Tenant 4 - Agent+Reviewer)', category: 'Tenant' },
    { number: 443, label: 'Test User 443 (Tenant 4 - Author+Editor)', category: 'Tenant' },
    { number: 444, label: 'Test User 444 (Tenant 4 - Agent+Editor)', category: 'Tenant' },
    { number: 445, label: 'Test User 445 (Tenant 4 - Reviewer+Editor)', category: 'Tenant' },
  ];

  return (
    <Box style={{ maxWidth: '24rem', margin: '0 auto' }}>
      <Heading size="5" mb="4" style={{ textAlign: 'center' }}>Test User Sign In</Heading>

      <Box mt="6">
        <Heading size="4" mb="3" style={{ textAlign: 'center' }}>
          Create Session URLs
        </Heading>
        <ScrollArea type="always" scrollbars="vertical" style={{ height: 300 }}>
          <Box p="3" style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--radius-3)', backgroundColor: 'var(--gray-1)' }}>
            <Flex direction="column" gap="2">
              {testUsers.map((user) => {
                const isCurrentUser = session?.user?.email === `test-user-${user.number}@logosophe.test`;
                const isCreating = creatingSession === `test-user-${user.number}@logosophe.test`;
                const hasSession = hasActiveSession(user.number);

                return (
                  <Button
                    key={user.number}
                    variant={isCurrentUser ? "solid" : "soft"}
                    color={isCurrentUser ? "green" : hasSession ? "blue" : "gray"}
                    size="2"
                    onClick={() => handleQuickAction(user.number)}
                    disabled={isCreating}
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                  >
                    {isCreating ? 'Creating Session...' :
                     hasSession ? `${user.label} (Click to Terminate)` :
                     user.label}
                  </Button>
                );
              })}
            </Flex>
          </Box>
        </ScrollArea>
      </Box>

      {lastCreatedSession && (
        <Box mt="4" p="3" style={{
          backgroundColor: 'var(--green-1)',
          border: '1px solid var(--green-4)',
          borderRadius: 'var(--radius-3)'
        }}>
          <Heading size="3" mb="2" color="green">Last Created Session</Heading>
          <Text size="2" mb="2" weight="bold">{lastCreatedSession.email}</Text>
          <Box style={{
            backgroundColor: 'var(--gray-2)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-2)',
            fontFamily: 'monospace',
            fontSize: 'var(--font-size-1)',
            wordBreak: 'break-all'
          }}>
            {lastCreatedSession.url}
          </Box>
          <Flex gap="2" mt="2">
            <Button size="1" variant="soft" onClick={() => navigator.clipboard.writeText(lastCreatedSession.url)}>
              Copy URL
            </Button>
            <Button
              size="1"
              variant="soft"
              color="gray"
              onClick={() => {
                setLastCreatedSession(null);
                fetchActiveSessions();
                window.dispatchEvent(new CustomEvent('test-session-updated'));
                setSessionsRefreshKey(prev => prev + 1);
              }}
            >
              Clear
            </Button>
          </Flex>
        </Box>
      )}

      <Box mt="6">
        <Heading size="3" mb="2" style={{ textAlign: 'center' }}>Test User Ranges:</Heading>
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">• 201-205: Signed users (not opted in)</Text>
          <Text size="2" color="gray">• 301-305: Opted-in users (default tenant)</Text>
          <Text size="2" color="gray">• 411-445: Tenant users (4-X-Y pattern: 4=class, X=tenant 1-4, Y=user 1-5)</Text>
        </Flex>
      </Box>
    </Box>
  );
}

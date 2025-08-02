'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Box, Button, Flex, Grid, Heading, Text, TextField, ScrollArea, Switch } from '@radix-ui/themes';
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
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [multiUserMode, setMultiUserMode] = useState(false);
  const [creatingSession, setCreatingSession] = useState<string | null>(null);
  const [lastCreatedSession, setLastCreatedSession] = useState<{ email: string; url: string } | null>(null);
  const [activeSessions, setActiveSessions] = useState<TestSession[]>([]);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();

  // Fetch active sessions to determine button colors
  const fetchActiveSessions = async () => {
    try {
      console.log('Fetching active sessions for button colors...');
      const response = await fetch('/api/test-sessions/list');
      console.log('Active sessions response status:', response.status);
      
      if (response.ok) {
        const data: SessionsResponse = await response.json();
        console.log('Active sessions data:', data);
        console.log('Number of active sessions:', data.sessions.length);
        setActiveSessions(data.sessions);
        console.log('Active sessions state updated');
      } else {
        console.error('Failed to fetch active sessions:', response.status);
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

  useEffect(() => {
    if (multiUserMode) {
      fetchActiveSessions();
    }
  }, [multiUserMode, sessionsRefreshKey]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // If there's a current user (admin or other test user), go to sign-out confirmation
      if (session?.user) {
        const encodedTestUser = encodeURIComponent(email);
        router.push(`/signout?callback=test-user&testUser=${encodedTestUser}`);
        return;
      }
      
      // If no current user, sign in directly
      const result = await signIn('test-credentials', {
        email,
        redirect: false,
      });

      if (result?.error) {
        console.error('Sign in error:', result.error);
        showToast({
          type: 'error',
          title: 'Sign In Failed',
          content: 'Sign in failed. Please check your email address.'
        });
      } else {
        router.push('/harbor');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      showToast({
        type: 'error',
        title: 'Sign In Failed',
        content: 'Sign in failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestSession = async (testUserEmail: string) => {
    try {
      setCreatingSession(testUserEmail);
      
      const response = await fetch('/api/test-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testUserEmail }),
      });

      if (!response.ok) {
        const error = await response.json() as { error: string };
        throw new Error(error.error || 'Failed to create session');
      }

      const data = await response.json() as { sessionUrl: string };
      
      // Store the session info for display
      setLastCreatedSession({ email: testUserEmail, url: data.sessionUrl });
      
      // Copy session URL to clipboard
      await navigator.clipboard.writeText(data.sessionUrl);
      
      // Refresh active sessions to update button colors
      // Add a small delay to ensure the database has been updated
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
      console.error('Error creating test session:', error);
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
    
    if (multiUserMode) {
      // Check if this user already has an active session
      const existingSession = activeSessions.find(session => session.testUserEmail === testEmail);
      
      if (existingSession) {
        // If session exists, terminate it
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
            // Refresh active sessions to update button colors
            await fetchActiveSessions();
            // Notify dashboard to refresh
            window.dispatchEvent(new CustomEvent('test-session-updated'));
            // Trigger component re-render
            setSessionsRefreshKey(prev => prev + 1);
          } else {
            const error = await response.json() as { error: string };
            showToast({
              type: 'error',
              title: 'Error',
              content: error.error || 'Failed to terminate session'
            });
          }
        } catch (error) {
          console.error('Error terminating session:', error);
          showToast({
            type: 'error',
            title: 'Error',
            content: 'Failed to terminate session'
          });
        }
      } else {
        // Multi-user mode: create session URL
        await createTestSession(testEmail);
      }
    } else {
      // Single-user mode: existing behavior
      if (session?.user?.email === testEmail) {
        await signOut({ redirect: false });
        router.push('/en/test-users');
        return;
      }
      
      if (session?.user) {
        const encodedTestUser = encodeURIComponent(testEmail);
        router.push(`/signout?callback=test-user&testUser=${encodedTestUser}`);
        return;
      }
      
      setEmail(testEmail);
      
      try {
        const result = await signIn('test-credentials', {
          email: testEmail,
          redirect: false,
        });

        if (result?.error) {
          console.error('Sign in error:', result.error);
          showToast({
            type: 'error',
            title: 'Sign In Failed',
            content: 'Sign in failed. Please try again.'
          });
        } else {
          router.push('/harbor');
        }
      } catch (error) {
        console.error('Sign in error:', error);
        showToast({
          type: 'error',
          title: 'Sign In Failed',
          content: 'Sign in failed. Please try again.'
        });
      }
    }
  };

  // Check if a test user has an active session
  const hasActiveSession = (userNumber: number) => {
    const testEmail = `test-user-${userNumber}@logosophe.test`;
    const hasSession = activeSessions.some(session => session.testUserEmail === testEmail);
    console.log(`Checking if ${testEmail} has active session:`, hasSession);
    console.log('Current active sessions:', activeSessions.map(s => s.testUserEmail));
    return hasSession;
  };

  // Generate all test users
  const testUsers = [
    // Signed users (101-105, 201-205)
    { number: 101, label: 'Test User 101 (Signed)', category: 'Signed' },
    { number: 102, label: 'Test User 102 (Signed)', category: 'Signed' },
    { number: 103, label: 'Test User 103 (Signed)', category: 'Signed' },
    { number: 104, label: 'Test User 104 (Signed)', category: 'Signed' },
    { number: 105, label: 'Test User 105 (Signed)', category: 'Signed' },
    { number: 201, label: 'Test User 201 (Signed)', category: 'Signed' },
    { number: 202, label: 'Test User 202 (Signed)', category: 'Signed' },
    { number: 203, label: 'Test User 203 (Signed)', category: 'Signed' },
    { number: 204, label: 'Test User 204 (Signed)', category: 'Signed' },
    { number: 205, label: 'Test User 205 (Signed)', category: 'Signed' },
    // Opted-in users (301-305)
    { number: 301, label: 'Test User 301 (Opted In)', category: 'Opted In' },
    { number: 302, label: 'Test User 302 (Opted In)', category: 'Opted In' },
    { number: 303, label: 'Test User 303 (Opted In)', category: 'Opted In' },
    { number: 304, label: 'Test User 304 (Opted In)', category: 'Opted In' },
    { number: 305, label: 'Test User 305 (Opted In)', category: 'Opted In' },
    // Tenant users (410-469) - Second digit indicates tenant, third digit indicates role
    // Tenant 1 (410-419)
    { number: 410, label: 'Test User 410 (Tenant 1 - Author)', category: 'Tenant' },
    { number: 411, label: 'Test User 411 (Tenant 1 - Agent)', category: 'Tenant' },
    { number: 412, label: 'Test User 412 (Tenant 1 - Reviewer)', category: 'Tenant' },
    { number: 413, label: 'Test User 413 (Tenant 1 - Editor)', category: 'Tenant' },
    { number: 414, label: 'Test User 414 (Tenant 1 - Author+Reviewer)', category: 'Tenant' },
    { number: 415, label: 'Test User 415 (Tenant 1 - Agent+Reviewer)', category: 'Tenant' },
    { number: 416, label: 'Test User 416 (Tenant 1 - Author+Editor)', category: 'Tenant' },
    { number: 417, label: 'Test User 417 (Tenant 1 - Agent+Editor)', category: 'Tenant' },
    { number: 418, label: 'Test User 418 (Tenant 1 - Reviewer+Editor)', category: 'Tenant' },
    { number: 419, label: 'Test User 419 (Tenant 1 - Author+Agent)', category: 'Tenant' },
    // Tenant 2 (420-429)
    { number: 420, label: 'Test User 420 (Tenant 2 - Author)', category: 'Tenant' },
    { number: 421, label: 'Test User 421 (Tenant 2 - Agent)', category: 'Tenant' },
    { number: 422, label: 'Test User 422 (Tenant 2 - Reviewer)', category: 'Tenant' },
    { number: 423, label: 'Test User 423 (Tenant 2 - Editor)', category: 'Tenant' },
    { number: 424, label: 'Test User 424 (Tenant 2 - Author+Reviewer)', category: 'Tenant' },
    { number: 425, label: 'Test User 425 (Tenant 2 - Agent+Reviewer)', category: 'Tenant' },
    { number: 426, label: 'Test User 426 (Tenant 2 - Author+Editor)', category: 'Tenant' },
    { number: 427, label: 'Test User 427 (Tenant 2 - Agent+Editor)', category: 'Tenant' },
    { number: 428, label: 'Test User 428 (Tenant 2 - Reviewer+Editor)', category: 'Tenant' },
    { number: 429, label: 'Test User 429 (Tenant 2 - Author+Agent)', category: 'Tenant' },
    // Tenant 3 (430-439)
    { number: 430, label: 'Test User 430 (Tenant 3 - Author)', category: 'Tenant' },
    { number: 431, label: 'Test User 431 (Tenant 3 - Agent)', category: 'Tenant' },
    { number: 432, label: 'Test User 432 (Tenant 3 - Reviewer)', category: 'Tenant' },
    { number: 433, label: 'Test User 433 (Tenant 3 - Editor)', category: 'Tenant' },
    { number: 434, label: 'Test User 434 (Tenant 3 - Author+Reviewer)', category: 'Tenant' },
    { number: 435, label: 'Test User 435 (Tenant 3 - Agent+Reviewer)', category: 'Tenant' },
    { number: 436, label: 'Test User 436 (Tenant 3 - Author+Editor)', category: 'Tenant' },
    { number: 437, label: 'Test User 437 (Tenant 3 - Agent+Editor)', category: 'Tenant' },
    { number: 438, label: 'Test User 438 (Tenant 3 - Reviewer+Editor)', category: 'Tenant' },
    { number: 439, label: 'Test User 439 (Tenant 3 - Author+Agent)', category: 'Tenant' },
    // Tenant 4 (440-449)
    { number: 440, label: 'Test User 440 (Tenant 4 - Author)', category: 'Tenant' },
    { number: 441, label: 'Test User 441 (Tenant 4 - Agent)', category: 'Tenant' },
    { number: 442, label: 'Test User 442 (Tenant 4 - Reviewer)', category: 'Tenant' },
    { number: 443, label: 'Test User 443 (Tenant 4 - Editor)', category: 'Tenant' },
    { number: 444, label: 'Test User 444 (Tenant 4 - Author+Reviewer)', category: 'Tenant' },
    { number: 445, label: 'Test User 445 (Tenant 4 - Agent+Reviewer)', category: 'Tenant' },
    { number: 446, label: 'Test User 446 (Tenant 4 - Author+Editor)', category: 'Tenant' },
    { number: 447, label: 'Test User 447 (Tenant 4 - Agent+Editor)', category: 'Tenant' },
    { number: 448, label: 'Test User 448 (Tenant 4 - Reviewer+Editor)', category: 'Tenant' },
    { number: 449, label: 'Test User 449 (Tenant 4 - Author+Agent)', category: 'Tenant' },
    // Tenant 5 (450-459)
    { number: 450, label: 'Test User 450 (Tenant 5 - Author)', category: 'Tenant' },
    { number: 451, label: 'Test User 451 (Tenant 5 - Agent)', category: 'Tenant' },
    { number: 452, label: 'Test User 452 (Tenant 5 - Reviewer)', category: 'Tenant' },
    { number: 453, label: 'Test User 453 (Tenant 5 - Editor)', category: 'Tenant' },
    { number: 454, label: 'Test User 454 (Tenant 5 - Author+Reviewer)', category: 'Tenant' },
    { number: 455, label: 'Test User 455 (Tenant 5 - Agent+Reviewer)', category: 'Tenant' },
    { number: 456, label: 'Test User 456 (Tenant 5 - Author+Editor)', category: 'Tenant' },
    { number: 457, label: 'Test User 457 (Tenant 5 - Agent+Editor)', category: 'Tenant' },
    { number: 458, label: 'Test User 458 (Tenant 5 - Reviewer+Editor)', category: 'Tenant' },
    { number: 459, label: 'Test User 459 (Tenant 5 - Author+Agent)', category: 'Tenant' },
    // Tenant 6 (460-469)
    { number: 460, label: 'Test User 460 (Tenant 6 - Author)', category: 'Tenant' },
    { number: 461, label: 'Test User 461 (Tenant 6 - Agent)', category: 'Tenant' },
    { number: 462, label: 'Test User 462 (Tenant 6 - Reviewer)', category: 'Tenant' },
    { number: 463, label: 'Test User 463 (Tenant 6 - Editor)', category: 'Tenant' },
    { number: 464, label: 'Test User 464 (Tenant 6 - Author+Reviewer)', category: 'Tenant' },
    { number: 465, label: 'Test User 465 (Tenant 6 - Agent+Reviewer)', category: 'Tenant' },
    { number: 466, label: 'Test User 466 (Tenant 6 - Author+Editor)', category: 'Tenant' },
    { number: 467, label: 'Test User 467 (Tenant 6 - Agent+Editor)', category: 'Tenant' },
    { number: 468, label: 'Test User 468 (Tenant 6 - Reviewer+Editor)', category: 'Tenant' },
    { number: 469, label: 'Test User 469 (Tenant 6 - Author+Agent)', category: 'Tenant' },
  ];

  return (
    <Box style={{ maxWidth: '24rem', margin: '0 auto' }}>
      <Heading size="5" mb="4" style={{ textAlign: 'center' }}>Test User Sign In</Heading>
      
      {/* Mode Toggle */}
      <Box mb="4" p="3" style={{ 
        backgroundColor: 'var(--gray-1)', 
        borderRadius: 'var(--radius-3)',
        border: '1px solid var(--gray-4)'
      }}>
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between">
            <Box>
              <Text weight="bold" size="2" mb="2">Mode:</Text>
              <Text size="2" color="gray">
                {multiUserMode ? 'Multi-User (Keep Admin Signed In)' : 'Single User (Sign Out Admin)'}
              </Text>
            </Box>
            <Switch 
              checked={multiUserMode}
              onCheckedChange={setMultiUserMode}
            />
          </Flex>
          {multiUserMode && (
            <Box p="2" style={{ 
              backgroundColor: 'var(--blue-1)', 
              borderRadius: 'var(--radius-2)',
              border: '1px solid var(--blue-4)'
            }}>
              <Text size="1" color="blue">
                💡 Tip: Open session URLs in different browsers/devices to maintain admin access. Using the same browser will replace your admin session.
              </Text>
            </Box>
          )}
        </Flex>
      </Box>
      
      {!multiUserMode && (
        <form onSubmit={handleSignIn}>
          <Flex direction="column" gap="4">
            <Box>
              <Text as="label" size="2" weight="bold" mb="2" style={{ display: 'block' }}>
                Test User Email
              </Text>
              <TextField.Root>
                <TextField.Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="test-user-101@logosophe.test"
                  required
                />
              </TextField.Root>
            </Box>
            
            <Button type="submit" disabled={isLoading} size="3">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Flex>
        </form>
      )}

      <Box mt="6">
        <Heading size="4" mb="3" style={{ textAlign: 'center' }}>
          {multiUserMode ? 'Create Session URLs' : 'Quick Sign In/Out'}
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
                    color={
                      isCurrentUser ? "green" : 
                      hasSession ? "blue" : 
                      "gray"
                    }
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

      {/* Display last created session URL */}
      {multiUserMode && lastCreatedSession && (
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
            <Button
              size="1"
              variant="soft"
              onClick={() => navigator.clipboard.writeText(lastCreatedSession.url)}
            >
              Copy URL
            </Button>
            <Button
              size="1"
              variant="soft"
              color="gray"
              onClick={() => {
                setLastCreatedSession(null);
                // Refresh active sessions to update button colors
                fetchActiveSessions();
                // Notify dashboard to refresh
                window.dispatchEvent(new CustomEvent('test-session-updated'));
                // Trigger component re-render
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
          <Text size="2" color="gray">• 101-105: Signed users (not opted in)</Text>
          <Text size="2" color="gray">• 201-205: Signed users (not opted in)</Text>
          <Text size="2" color="gray">• 301-305: Opted-in users (default tenant)</Text>
          <Text size="2" color="gray">• 410-469: Tenant users (second digit = tenant, third digit = role)</Text>
        </Flex>
      </Box>
    </Box>
  );
} 
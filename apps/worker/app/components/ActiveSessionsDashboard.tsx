'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Card, Flex, Heading, Text, ScrollArea, Dialog } from '@radix-ui/themes';
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
  isActive: boolean;
}

interface SessionsResponse {
  success: boolean;
  sessions: TestSession[];
  sessionCount: number;
  maxSessions: number;
}

export default function ActiveSessionsDashboard() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [maxSessions, setMaxSessions] = useState(15);
  const [loading, setLoading] = useState(true);
  const [terminatingSession, setTerminatingSession] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState<TestSession | null>(null);
  const { showToast } = useToast();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      console.log('Fetching sessions...');
      const response = await fetch('/api/test-sessions/list');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data: SessionsResponse = await response.json();
        console.log('Sessions data:', data);
        console.log('Number of sessions:', data.sessions.length);
        console.log('Session count:', data.sessionCount);
        console.log('Max sessions:', data.maxSessions);
        setSessions(data.sessions);
        setSessionCount(data.sessionCount);
        setMaxSessions(data.maxSessions);
      } else if (response.status === 401) {
        console.error('Unauthorized - user not authenticated as admin');
        showToast({
          type: 'error',
          title: 'Authentication Required',
          content: 'Please sign in as admin to manage test sessions'
        });
      } else {
        console.error('Failed to fetch sessions, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        showToast({
          type: 'error',
          title: 'Error',
          content: 'Failed to load active sessions'
        });
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to load active sessions'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    
    // Listen for session updates from TestUserSignIn component
    const handleSessionUpdate = () => {
      fetchSessions();
    };
    
    window.addEventListener('test-session-updated', handleSessionUpdate);
    
    return () => {
      window.removeEventListener('test-session-updated', handleSessionUpdate);
    };
  }, []);

  const terminateSession = async (session: TestSession) => {
    // Check if session is active
    if (session.isActive) {
      setSessionToTerminate(session);
      setShowTerminateConfirm(true);
      return;
    }
    
    // If not active, terminate immediately
    await performTerminateSession(session.id);
  };

  const performTerminateSession = async (sessionId: number) => {
    try {
      setTerminatingSession(sessionId);
      console.log('Attempting to terminate session:', sessionId);
      const response = await fetch(`/api/test-sessions/${sessionId}`, {
        method: 'DELETE',
      });

      console.log('Terminate session response status:', response.status);
      
      if (response.ok) {
        const data = await response.json() as { success: boolean; message?: string };
        console.log('Terminate session response data:', data);
        showToast({
          type: 'success',
          title: 'Success',
          content: data.message || 'Session terminated successfully'
        });
        fetchSessions(); // Refresh the list
      } else {
        const errorText = await response.text();
        console.error('Terminate session error response:', errorText);
        let errorMessage = 'Failed to terminate session';
        try {
          const errorData = JSON.parse(errorText) as { error: string };
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        showToast({
          type: 'error',
          title: 'Error',
          content: errorMessage
        });
      }
    } catch (error) {
      console.error('Error terminating session:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to terminate session'
      });
    } finally {
      setTerminatingSession(null);
    }
  };

  const clearAllSessions = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearAllSessions = async () => {
    try {
      setClearingAll(true);
      console.log('Attempting to clear all sessions...');
      const response = await fetch('/api/test-sessions/clear-all', {
        method: 'DELETE',
      });

      console.log('Clear all response status:', response.status);
      
      if (response.ok) {
        const data = await response.json() as { sessionsCleared: number; message?: string };
        console.log('Clear all response data:', data);
        showToast({
          type: 'success',
          title: 'Success',
          content: data.message || `Cleared ${data.sessionsCleared} active sessions`
        });
        fetchSessions(); // Refresh the list
      } else {
        const errorText = await response.text();
        console.error('Clear all error response:', errorText);
        let errorMessage = 'Failed to clear sessions';
        try {
          const errorData = JSON.parse(errorText) as { error: string };
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        showToast({
          type: 'error',
          title: 'Error',
          content: errorMessage
        });
      }
    } catch (error) {
      console.error('Error clearing sessions:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to clear sessions'
      });
    } finally {
      setClearingAll(false);
      setShowClearConfirm(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        type: 'success',
        title: 'Copied',
        content: `${label} copied to clipboard`
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to copy to clipboard'
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Box>
        <Heading size="4" mb="3">Active Sessions Dashboard</Heading>
        <Text color="gray">Loading sessions...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="4">Active Sessions Dashboard</Heading>
        <Flex gap="2" align="center">
          <Text size="2" color="gray">
            Sessions: {sessionCount}/{maxSessions}
          </Text>
          <Button
            size="1"
            variant="soft"
            onClick={fetchSessions}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Flex>
      </Flex>

      {sessions.length === 0 ? (
        <Card size="2">
          <Box p="4" style={{ textAlign: 'center' }}>
            <Text color="gray">No active test sessions</Text>
          </Box>
        </Card>
      ) : (
        <ScrollArea type="always" scrollbars="vertical" style={{ height: 400 }}>
          <Flex direction="column" gap="3">
            {sessions.map((session) => (
              <Card key={session.id} size="2">
                <Box p="3">
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="2">
                        <Text weight="bold" size="3">
                          {session.testUserEmail}
                        </Text>
                        {session.isActive && (
                          <Box style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--green-9)',
                            flexShrink: 0
                          }} />
                        )}
                        {session.isActive && (
                          <Text size="1" color="green" weight="bold">
                            ACTIVE
                          </Text>
                        )}
                      </Flex>
                      <Button
                        size="1"
                        color="red"
                        variant="soft"
                        onClick={() => terminateSession(session)}
                        disabled={terminatingSession === session.id}
                      >
                        {terminatingSession === session.id ? 'Terminating...' : 'Sign Out'}
                      </Button>
                    </Flex>
                    
                    <Text size="2" color="gray">
                      Created: {formatDate(session.createdAt)}
                    </Text>
                    
                    {session.lastAccessed && (
                      <Text size="2" color="gray">
                        Last accessed: {formatDate(session.lastAccessed)}
                      </Text>
                    )}
                    
                    <Text size="2" color="gray">
                      Created by: {session.createdBy}
                    </Text>
                    
                    <Box>
                      <Text size="2" weight="bold" mb="1">Session URL:</Text>
                      <Flex gap="2" align="center">
                        <Box style={{ 
                          backgroundColor: 'var(--gray-2)', 
                          padding: 'var(--space-2)', 
                          borderRadius: 'var(--radius-2)',
                          fontFamily: 'monospace',
                          fontSize: 'var(--font-size-1)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {session.sessionUrl}
                        </Box>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => copyToClipboard(session.sessionUrl, 'Session URL')}
                        >
                          Copy
                        </Button>
                      </Flex>
                    </Box>
                  </Flex>
                </Box>
              </Card>
            ))}
          </Flex>
        </ScrollArea>
      )}

      {sessions.length > 0 && (
        <Box mt="4">
          <Button
            color="red"
            variant="solid"
            onClick={clearAllSessions}
            disabled={clearingAll}
          >
            {clearingAll ? 'Clearing All Sessions...' : 'Clear All Sessions'}
          </Button>
        </Box>
      )}

      {/* Confirmation Dialog for Clear All Sessions */}
      <Dialog.Root open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <Dialog.Content style={{ 
          maxHeight: '90vh', 
          overflow: 'auto', 
          position: 'fixed', 
          top: '20%', 
          left: '50%', 
          transform: 'translate(-50%, 0)',
          zIndex: 100000,
          backgroundColor: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-6)',
          borderRadius: 'var(--radius-3)',
          boxShadow: 'var(--shadow-4)'
        }}>
          <Dialog.Title>Clear All Sessions</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to terminate all active test sessions? This action cannot be undone.
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button 
              color="red" 
              onClick={confirmClearAllSessions}
              disabled={clearingAll}
            >
              {clearingAll ? 'Clearing...' : 'Clear All Sessions'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Confirmation Dialog for Terminating Active Session */}
      <Dialog.Root open={showTerminateConfirm} onOpenChange={setShowTerminateConfirm}>
        <Dialog.Content style={{ 
          maxHeight: '90vh', 
          overflow: 'auto', 
          position: 'fixed', 
          top: '20%', 
          left: '50%', 
          transform: 'translate(-50%, 0)',
          zIndex: 100000,
          backgroundColor: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-6)',
          borderRadius: 'var(--radius-3)',
          boxShadow: 'var(--shadow-4)'
        }}>
          <Dialog.Title>Terminate Active Session</Dialog.Title>
          <Dialog.Description>
            <Box mb="3">
              <Text>
                This test user is currently signed in and has an active session. Terminating will:
              </Text>
              <Box mt="2" ml="3">
                <Text size="2" as="div">
                  • Sign out the user immediately
                </Text>
                <Text size="2" as="div">
                  • Remove the session from both TestSessions and sessions tables
                </Text>
                <Text size="2" as="div">
                  • End their current browser session
                </Text>
              </Box>
              <Text mt="3" weight="bold">
                Test User: {sessionToTerminate?.testUserEmail}
              </Text>
            </Box>
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button 
              color="red" 
              onClick={() => {
                if (sessionToTerminate) {
                  performTerminateSession(sessionToTerminate.id);
                }
                setShowTerminateConfirm(false);
                setSessionToTerminate(null);
              }}
              disabled={terminatingSession === sessionToTerminate?.id}
            >
              {terminatingSession === sessionToTerminate?.id ? 'Terminating...' : 'Terminate Session'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 
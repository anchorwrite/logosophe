'use client';

import { useState } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, Switch, TextField, Badge } from '@radix-ui/themes';

interface SystemSettings {
  messagingEnabled: boolean;
  rateLimitSeconds: number;
  maxRecipients: number;
  recallWindowSeconds: number;
  messageExpiryDays: number;
}

interface SystemStats {
  totalMessages: number;
  activeUsers: number;
  blockedUsers: number;
  recentMessages: number;
}

interface SystemControlsClientProps {
  initialData: {
    settings: SystemSettings;
    stats: SystemStats;
  };
}

export function SystemControlsClient({ initialData }: SystemControlsClientProps) {
  const [settings, setSettings] = useState<SystemSettings>(initialData.settings);

  const updateSetting = async (setting: keyof SystemSettings, value: any) => {
    try {
      const response = await fetch('/api/dashboard/messaging/system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setting, value }),
      });

      if (response.ok) {
        // Update local state
        setSettings((prev: SystemSettings) => ({ ...prev, [setting]: value }));
      } else {
        console.error('Failed to update setting:', response.status);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          System Controls
        </Heading>
        <Text color="gray" size="3">
          Configure messaging system settings and monitor system health
        </Text>
      </Box>

      {/* System Statistics */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            System Statistics
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Total Messages</Text>
              <Heading size="3">{initialData.stats.totalMessages}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Active Users</Text>
              <Heading size="3">{initialData.stats.activeUsers}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Blocked Users</Text>
              <Heading size="3">{initialData.stats.blockedUsers}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Messages (7 days)</Text>
              <Heading size="3">{initialData.stats.recentMessages}</Heading>
            </Box>
          </Flex>
        </Box>
      </Card>

      {/* System Settings */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            System Settings
          </Heading>
          
          <Flex direction="column" gap="4">
            {/* Messaging Enabled */}
            <Flex justify="between" align="center">
              <Box>
                <Text weight="medium" style={{ marginBottom: '0.25rem' }}>
                  Messaging System
                </Text>
                <Text size="2" color="gray">
                  Enable or disable the entire messaging system
                </Text>
              </Box>
              <Flex align="center" gap="2">
                <Badge variant={settings.messagingEnabled ? 'solid' : 'soft'}>
                  {settings.messagingEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Switch 
                  checked={settings.messagingEnabled}
                  onCheckedChange={(checked) => {
                    updateSetting('messagingEnabled', checked);
                  }}
                />
              </Flex>
            </Flex>

            {/* Rate Limiting */}
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Rate Limiting
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Minimum seconds between messages per user
              </Text>
              <TextField.Root style={{ width: '200px' }}>
                <TextField.Input 
                  type="number" 
                  value={settings.rateLimitSeconds}
                  onChange={(e) => {
                    updateSetting('rateLimitSeconds', parseInt(e.target.value));
                  }}
                  min="1"
                  max="3600"
                />
                <TextField.Slot>
                  <Text size="2" color="gray">seconds</Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* Max Recipients */}
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Maximum Recipients
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Maximum number of recipients per message
              </Text>
              <TextField.Root style={{ width: '200px' }}>
                <TextField.Input 
                  type="number" 
                  value={settings.maxRecipients}
                  onChange={(e) => {
                    updateSetting('maxRecipients', parseInt(e.target.value));
                  }}
                  min="1"
                  max="1000"
                />
                <TextField.Slot>
                  <Text size="2" color="gray">recipients</Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* Recall Window */}
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Message Recall Window
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Time window in seconds for message recall
              </Text>
              <TextField.Root style={{ width: '200px' }}>
                <TextField.Input 
                  type="number" 
                  value={settings.recallWindowSeconds}
                  onChange={(e) => {
                    updateSetting('recallWindowSeconds', parseInt(e.target.value));
                  }}
                  min="0"
                  max="86400"
                />
                <TextField.Slot>
                  <Text size="2" color="gray">seconds</Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* Message Expiry */}
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Message Expiry
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Days before old messages are automatically deleted
              </Text>
              <TextField.Root style={{ width: '200px' }}>
                <TextField.Input 
                  type="number" 
                  value={settings.messageExpiryDays}
                  onChange={(e) => {
                    updateSetting('messageExpiryDays', parseInt(e.target.value));
                  }}
                  min="1"
                  max="365"
                />
                <TextField.Slot>
                  <Text size="2" color="gray">days</Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>
          </Flex>
        </Box>
      </Card>

      {/* System Actions */}
      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            System Actions
          </Heading>
          
          <Flex direction="column" gap="3">
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Cleanup Expired Messages
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Delete messages older than the expiry period
              </Text>
              <Button variant="soft">Run Cleanup</Button>
            </Box>

            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Cleanup Rate Limits
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Clear expired rate limit entries
              </Text>
              <Button variant="soft">Clear Rate Limits</Button>
            </Box>

            <Box>
              <Text weight="medium" style={{ marginBottom: '0.5rem' }}>
                Export System Logs
              </Text>
              <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
                Download messaging activity logs
              </Text>
              <Button variant="soft">Export Logs</Button>
            </Box>
          </Flex>
        </Box>
      </Card>
    </Container>
  );
} 
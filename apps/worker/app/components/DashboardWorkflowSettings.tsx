'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Text, Heading, Flex, Button, TextField, Switch, Select, Tabs, Badge } from '@radix-ui/themes';

interface WorkflowSettings {
  maxWorkflowsPerTenant: number;
  maxParticipantsPerWorkflow: number;
  maxMessagesPerWorkflow: number;
  workflowTimeoutHours: number;
  autoArchiveDays: number;
  allowWorkflowPause: boolean;
  allowWorkflowTermination: boolean;
  requireApproval: boolean;
  enableNotifications: boolean;
  enableAuditLogging: boolean;
  defaultWorkflowStatus: string;
  retentionPolicy: string;
  backupFrequency: string;
}

interface SystemConfig {
  settings: WorkflowSettings;
  lastUpdated: string;
  updatedBy: string;
}

interface DashboardWorkflowSettingsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
}

export function DashboardWorkflowSettings({ 
  userEmail, 
  isGlobalAdmin 
}: DashboardWorkflowSettingsProps) {
  const [settings, setSettings] = useState<WorkflowSettings>({
    maxWorkflowsPerTenant: 100,
    maxParticipantsPerWorkflow: 50,
    maxMessagesPerWorkflow: 1000,
    workflowTimeoutHours: 168, // 7 days
    autoArchiveDays: 30,
    allowWorkflowPause: true,
    allowWorkflowTermination: true,
    requireApproval: false,
    enableNotifications: true,
    enableAuditLogging: true,
    defaultWorkflowStatus: 'active',
    retentionPolicy: '90days',
    backupFrequency: 'daily'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/dashboard/workflow/settings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json() as { success: boolean; config?: { settings: WorkflowSettings; lastUpdated: string; updatedBy: string }; error?: string };
        
        if (data.success && data.config) {
          setSettings(data.config.settings);
        } else {
          setError(data.error || 'Failed to fetch settings');
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      fetchSettings();
    }
  }, [userEmail]);

  const handleSettingChange = (key: keyof WorkflowSettings, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/dashboard/workflow/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings,
          userEmail,
          isGlobalAdmin
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as { success: boolean; error?: string };
      
      if (data.success) {
        setSuccess('Settings saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/dashboard/workflow/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          isGlobalAdmin
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as { success: boolean; config?: { settings: WorkflowSettings; lastUpdated: string; updatedBy: string }; error?: string };
      
      if (data.success && data.config) {
        setSettings(data.config.settings);
        setSuccess('Settings reset to defaults successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">Loading settings...</Text>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="red">{error}</Text>
        </Box>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box p="4">
          <Flex justify="between" align="center">
            <Box>
              <Heading size="3">Workflow System Settings</Heading>
              <Text size="2" color="gray">
                Configure global workflow system settings and policies
              </Text>
            </Box>
            <Flex gap="2">
              <Button 
                variant="soft" 
                onClick={resetToDefaults}
                disabled={saving}
              >
                Reset to Defaults
              </Button>
              <Button 
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Flex>
          </Flex>
          {success && (
            <Box style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--green-2)', borderRadius: 'var(--radius-3)' }}>
              <Text size="2" color="green">{success}</Text>
            </Box>
          )}
        </Box>
      </Card>

      <Tabs.Root defaultValue="limits">
        <Tabs.List>
          <Tabs.Trigger value="limits">Limits & Quotas</Tabs.Trigger>
          <Tabs.Trigger value="behavior">Workflow Behavior</Tabs.Trigger>
          <Tabs.Trigger value="security">Security & Compliance</Tabs.Trigger>
          <Tabs.Trigger value="retention">Data Retention</Tabs.Trigger>
        </Tabs.List>

        <Box pt="3">
          <Tabs.Content value="limits">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Limits & Quotas</Heading>
                <Flex direction="column" gap="4">
                  <Flex gap="4" wrap="wrap">
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Max Workflows per Tenant
                      </Text>
                      <TextField.Root>
                        <TextField.Input
                          type="number"
                          value={settings.maxWorkflowsPerTenant}
                          onChange={(e) => handleSettingChange('maxWorkflowsPerTenant', parseInt(e.target.value) || 0)}
                          min="1"
                          max="10000"
                        />
                      </TextField.Root>
                      <Text size="1" color="gray">Maximum number of workflows a tenant can have</Text>
                    </Box>
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Max Participants per Workflow
                      </Text>
                      <TextField.Root>
                        <TextField.Input
                          type="number"
                          value={settings.maxParticipantsPerWorkflow}
                          onChange={(e) => handleSettingChange('maxParticipantsPerWorkflow', parseInt(e.target.value) || 0)}
                          min="1"
                          max="1000"
                        />
                      </TextField.Root>
                      <Text size="1" color="gray">Maximum number of participants in a single workflow</Text>
                    </Box>
                  </Flex>
                  <Flex gap="4" wrap="wrap">
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Max Messages per Workflow
                      </Text>
                      <TextField.Root>
                        <TextField.Input
                          type="number"
                          value={settings.maxMessagesPerWorkflow}
                          onChange={(e) => handleSettingChange('maxMessagesPerWorkflow', parseInt(e.target.value) || 0)}
                          min="1"
                          max="100000"
                        />
                      </TextField.Root>
                      <Text size="1" color="gray">Maximum number of messages in a single workflow</Text>
                    </Box>
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Workflow Timeout (Hours)
                      </Text>
                      <TextField.Root>
                        <TextField.Input
                          type="number"
                          value={settings.workflowTimeoutHours}
                          onChange={(e) => handleSettingChange('workflowTimeoutHours', parseInt(e.target.value) || 0)}
                          min="1"
                          max="8760"
                        />
                      </TextField.Root>
                      <Text size="1" color="gray">Maximum duration before workflow auto-termination</Text>
                    </Box>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="behavior">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Workflow Behavior</Heading>
                <Flex direction="column" gap="4">
                  <Flex gap="4" wrap="wrap">
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Default Workflow Status
                      </Text>
                      <Select.Root 
                        value={settings.defaultWorkflowStatus} 
                        onValueChange={(value) => handleSettingChange('defaultWorkflowStatus', value)}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="active">Active</Select.Item>
                          <Select.Item value="paused">Paused</Select.Item>
                          <Select.Item value="draft">Draft</Select.Item>
                        </Select.Content>
                      </Select.Root>
                      <Text size="1" color="gray">Default status for newly created workflows</Text>
                    </Box>
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Auto-Archive Days
                      </Text>
                      <TextField.Root>
                        <TextField.Input
                          type="number"
                          value={settings.autoArchiveDays}
                          onChange={(e) => handleSettingChange('autoArchiveDays', parseInt(e.target.value) || 0)}
                          min="0"
                          max="3650"
                        />
                      </TextField.Root>
                      <Text size="1" color="gray">Days before completed workflows are archived</Text>
                    </Box>
                  </Flex>
                  <Flex direction="column" gap="3">
                    <Flex gap="2" align="center">
                      <Switch
                        checked={settings.allowWorkflowPause}
                        onCheckedChange={(checked) => handleSettingChange('allowWorkflowPause', checked)}
                      />
                      <Text size="2">Allow workflow pausing</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <Switch
                        checked={settings.allowWorkflowTermination}
                        onCheckedChange={(checked) => handleSettingChange('allowWorkflowTermination', checked)}
                      />
                      <Text size="2">Allow workflow termination</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <Switch
                        checked={settings.requireApproval}
                        onCheckedChange={(checked) => handleSettingChange('requireApproval', checked)}
                      />
                      <Text size="2">Require approval for workflow creation</Text>
                    </Flex>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="security">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Security & Compliance</Heading>
                <Flex direction="column" gap="4">
                  <Flex direction="column" gap="3">
                    <Flex gap="2" align="center">
                      <Switch
                        checked={settings.enableNotifications}
                        onCheckedChange={(checked) => handleSettingChange('enableNotifications', checked)}
                      />
                      <Text size="2">Enable system notifications</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <Switch
                        checked={settings.enableAuditLogging}
                        onCheckedChange={(checked) => handleSettingChange('enableAuditLogging', checked)}
                      />
                      <Text size="2">Enable audit logging for all workflow activities</Text>
                    </Flex>
                  </Flex>
                  <Box style={{ padding: '1rem', backgroundColor: 'var(--amber-2)', borderRadius: 'var(--radius-3)' }}>
                    <Text size="2" color="amber">
                      <strong>Security Note:</strong> Audit logging is recommended for compliance and security monitoring. 
                      Disabling this feature may impact regulatory compliance.
                    </Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="retention">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Data Retention</Heading>
                <Flex direction="column" gap="4">
                  <Flex gap="4" wrap="wrap">
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Retention Policy
                      </Text>
                      <Select.Root 
                        value={settings.retentionPolicy} 
                        onValueChange={(value) => handleSettingChange('retentionPolicy', value)}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="30days">30 Days</Select.Item>
                          <Select.Item value="90days">90 Days</Select.Item>
                          <Select.Item value="1year">1 Year</Select.Item>
                          <Select.Item value="3years">3 Years</Select.Item>
                          <Select.Item value="indefinite">Indefinite</Select.Item>
                        </Select.Content>
                      </Select.Root>
                      <Text size="1" color="gray">How long to retain workflow data</Text>
                    </Box>
                    <Box style={{ flex: '1', minWidth: '250px' }}>
                      <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                        Backup Frequency
                      </Text>
                      <Select.Root 
                        value={settings.backupFrequency} 
                        onValueChange={(value) => handleSettingChange('backupFrequency', value)}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="hourly">Hourly</Select.Item>
                          <Select.Item value="daily">Daily</Select.Item>
                          <Select.Item value="weekly">Weekly</Select.Item>
                          <Select.Item value="monthly">Monthly</Select.Item>
                        </Select.Content>
                      </Select.Root>
                      <Text size="1" color="gray">How often to backup workflow data</Text>
                    </Box>
                  </Flex>
                  <Box style={{ padding: '1rem', backgroundColor: 'var(--blue-2)', borderRadius: 'var(--radius-3)' }}>
                    <Text size="2" color="blue">
                      <strong>Data Protection:</strong> These settings affect data retention and backup policies. 
                      Changes may take effect immediately and could impact storage costs.
                    </Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
} 
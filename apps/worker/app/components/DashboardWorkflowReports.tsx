'use client';

import { useState } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Select, TextField, Checkbox } from '@radix-ui/themes';

interface ReportConfig {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  includeDetails: boolean;
  format: string;
  tenantId?: string;
  status?: string;
}

interface DashboardWorkflowReportsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  tenants: Array<{ id: string; name: string }>;
}

export function DashboardWorkflowReports({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants,
  tenants 
}: DashboardWorkflowReportsProps) {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    reportType: 'summary',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    includeDetails: false,
    format: 'json'
  });
  const [generating, setGenerating] = useState(false);

  const handleConfigChange = (key: keyof ReportConfig, value: string | boolean) => {
    setReportConfig(prev => ({ ...prev, [key]: value }));
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      
      const response = await fetch('/api/dashboard/workflow/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...reportConfig,
          userEmail,
          isGlobalAdmin,
          accessibleTenants
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json() as { success: boolean; downloadUrl?: string; error?: string };
      
      if (result.success && result.downloadUrl) {
        // Create a download link
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `workflow-report-${reportConfig.reportType}-${new Date().toISOString().split('T')[0]}.${reportConfig.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getReportDescription = (reportType: string) => {
    switch (reportType) {
      case 'summary':
        return 'High-level workflow statistics and metrics';
      case 'detailed':
        return 'Comprehensive workflow data with all details';
      case 'performance':
        return 'Workflow performance and completion metrics';
      case 'activity':
        return 'Daily and weekly workflow activity trends';
      case 'participants':
        return 'Participant engagement and contribution data';
      default:
        return '';
    }
  };

  return (
    <Card>
      <Box p="4">
        <Heading size="3" style={{ marginBottom: '1rem' }}>
          Generate Workflow Reports
        </Heading>
        
        <Text size="2" color="gray" style={{ marginBottom: '2rem' }}>
          Create detailed reports of workflow activity and performance metrics
        </Text>

        <Flex direction="column" gap="4">
          {/* Report Type */}
          <Box>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Report Type
            </Text>
            <Select.Root 
              value={reportConfig.reportType} 
              onValueChange={(value) => handleConfigChange('reportType', value)}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="summary">Summary Report</Select.Item>
                <Select.Item value="detailed">Detailed Report</Select.Item>
                <Select.Item value="performance">Performance Report</Select.Item>
                <Select.Item value="activity">Activity Report</Select.Item>
                <Select.Item value="participants">Participants Report</Select.Item>
              </Select.Content>
            </Select.Root>
            <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
              {getReportDescription(reportConfig.reportType)}
            </Text>
          </Box>

          {/* Date Range */}
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                Start Date
              </Text>
              <TextField.Root>
                <TextField.Input
                  type="date"
                  value={reportConfig.dateFrom}
                  onChange={(e) => handleConfigChange('dateFrom', e.target.value)}
                />
              </TextField.Root>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                End Date
              </Text>
              <TextField.Root>
                <TextField.Input
                  type="date"
                  value={reportConfig.dateTo}
                  onChange={(e) => handleConfigChange('dateTo', e.target.value)}
                />
              </TextField.Root>
            </Box>
          </Flex>

          {/* Tenant Filter (Global Admin Only) */}
          {isGlobalAdmin && (
            <Box>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                Tenant (Optional)
              </Text>
              <Select.Root 
                value={reportConfig.tenantId || 'all'} 
                onValueChange={(value) => handleConfigChange('tenantId', value === 'all' ? '' : value)}
              >
                <Select.Trigger placeholder="All Tenants" />
                <Select.Content>
                  <Select.Item value="all">All Tenants</Select.Item>
                  {tenants.map((tenant) => (
                    <Select.Item key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
          )}

          {/* Status Filter */}
          <Box>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Status Filter (Optional)
            </Text>
            <Select.Root 
              value={reportConfig.status || 'all'} 
              onValueChange={(value) => handleConfigChange('status', value === 'all' ? '' : value)}
            >
              <Select.Trigger placeholder="All Statuses" />
              <Select.Content>
                <Select.Item value="all">All Statuses</Select.Item>
                <Select.Item value="active">Active</Select.Item>
                <Select.Item value="paused">Paused</Select.Item>
                <Select.Item value="completed">Completed</Select.Item>
                <Select.Item value="terminated">Terminated</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          {/* Report Options */}
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                Format
              </Text>
              <Select.Root 
                value={reportConfig.format} 
                onValueChange={(value) => handleConfigChange('format', value)}
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="json">JSON</Select.Item>
                  <Select.Item value="csv">CSV</Select.Item>
                  <Select.Item value="pdf">PDF</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Flex gap="2" align="center" style={{ marginTop: '1.5rem' }}>
                <Checkbox
                  checked={reportConfig.includeDetails}
                  onCheckedChange={(checked) => handleConfigChange('includeDetails', checked as boolean)}
                />
                <Text size="2">Include detailed information</Text>
              </Flex>
            </Box>
          </Flex>

          {/* Generate Button */}
          <Box style={{ marginTop: '1rem' }}>
            <Button 
              size="3" 
              onClick={generateReport}
              disabled={generating}
              style={{ width: '100%' }}
            >
              {generating ? 'Generating Report...' : 'Generate Report'}
            </Button>
          </Box>

          {/* Report Information */}
          <Box style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-3)' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Report Information
            </Text>
            <Text size="1" color="gray">
              • Date Range: {new Date(reportConfig.dateFrom).toLocaleDateString()} to {new Date(reportConfig.dateTo).toLocaleDateString()}
              <br />
              • Format: {reportConfig.format.toUpperCase()}
              <br />
              • Details: {reportConfig.includeDetails ? 'Included' : 'Excluded'}
              {reportConfig.tenantId && (
                <>
                  <br />
                  • Tenant: {tenants.find(t => t.id === reportConfig.tenantId)?.name || reportConfig.tenantId}
                </>
              )}
              {reportConfig.status && (
                <>
                  <br />
                  • Status: {reportConfig.status}
                </>
              )}
            </Text>
          </Box>
        </Flex>
      </Box>
    </Card>
  );
} 
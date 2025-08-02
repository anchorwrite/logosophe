'use client';

import { Tabs, Box } from '@radix-ui/themes';
import { DashboardWorkflowAnalytics } from '@/components/DashboardWorkflowAnalytics';
import { DashboardWorkflowReports } from '@/components/DashboardWorkflowReports';

interface WorkflowAnalyticsTabsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  userTenants: Array<{ id: string; name: string }>;
}

export function WorkflowAnalyticsTabs({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants,
  userTenants 
}: WorkflowAnalyticsTabsProps) {
  return (
    <Tabs.Root defaultValue="analytics">
      <Tabs.List>
        <Tabs.Trigger value="analytics">Analytics Dashboard</Tabs.Trigger>
        <Tabs.Trigger value="reports">Generate Reports</Tabs.Trigger>
      </Tabs.List>

      <Box pt="3">
        <Tabs.Content value="analytics">
          <DashboardWorkflowAnalytics 
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
            accessibleTenants={accessibleTenants}
          />
        </Tabs.Content>

        <Tabs.Content value="reports">
          <DashboardWorkflowReports 
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
            accessibleTenants={accessibleTenants}
            tenants={userTenants}
          />
        </Tabs.Content>
      </Box>
    </Tabs.Root>
  );
} 
'use client';

import { Tabs, Box } from '@radix-ui/themes';
import { DashboardWorkflowHistoryList } from '@/components/DashboardWorkflowHistoryList';

interface WorkflowHistoryTabsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
}

export function WorkflowHistoryTabs({ userEmail, isGlobalAdmin, accessibleTenants }: WorkflowHistoryTabsProps) {
  return (
    <Tabs.Root defaultValue="completed">
      <Tabs.List>
        <Tabs.Trigger value="completed">Completed Workflows</Tabs.Trigger>
        <Tabs.Trigger value="terminated">Terminated Workflows</Tabs.Trigger>
        <Tabs.Trigger value="deleted">Deleted Workflows</Tabs.Trigger>
      </Tabs.List>

      <Box pt="3">
        <Tabs.Content value="completed">
          <DashboardWorkflowHistoryList 
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
            accessibleTenants={accessibleTenants}
            status="completed"
            title="Completed Workflows"
            showPagination={true}
          />
        </Tabs.Content>

        <Tabs.Content value="terminated">
          <DashboardWorkflowHistoryList 
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
            accessibleTenants={accessibleTenants}
            status="terminated"
            title="Terminated Workflows"
            showPagination={true}
          />
        </Tabs.Content>

        <Tabs.Content value="deleted">
          <DashboardWorkflowHistoryList 
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
            accessibleTenants={accessibleTenants}
            status="deleted"
            title="Deleted Workflows"
            showPagination={true}
          />
        </Tabs.Content>
      </Box>
    </Tabs.Root>
  );
} 
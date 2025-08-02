'use client';

import { useState, useEffect } from 'react';
import { Dialog, Button, Text, Flex, Box, Checkbox } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

interface TenantAssignment {
  tenantId: string;
  tenantName: string;
  assigned: boolean;
}

interface TenantAssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  userRole: string;
  onSuccess: () => void;
}

export function TenantAssignmentDialog({ 
  isOpen, 
  onOpenChange, 
  userEmail, 
  userRole, 
  onSuccess 
}: TenantAssignmentDialogProps) {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<TenantAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Only show for tenant admin users
  const shouldShow = userRole === 'tenant';

  useEffect(() => {
    if (isOpen && shouldShow) {
      fetchAssignments();
    }
  }, [isOpen, userEmail, shouldShow]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tenants`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenant assignments');
      }
      const data = await response.json() as { assignments?: TenantAssignment[] };
      setAssignments(data.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      showToast({
        title: 'Error',
        content: 'Failed to load tenant assignments',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignmentChange = (tenantId: string, assigned: boolean) => {
    setAssignments(prev => 
      prev.map(assignment => 
        assignment.tenantId === tenantId 
          ? { ...assignment, assigned } 
          : assignment
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedTenantIds = assignments
        .filter(a => a.assigned)
        .map(a => a.tenantId);

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tenants`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantIds: selectedTenantIds }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to update tenant assignments');
      }

      const result = await response.json() as { added?: number; removed?: number };
      showToast({
        title: 'Success',
        content: `Tenant assignments updated successfully (${result.added} added, ${result.removed} removed)`,
        type: 'success'
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving assignments:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to update tenant assignments',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ 
        maxWidth: 600,
        width: '500px',
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, 0)',
        maxHeight: '70vh',
        overflow: 'auto',
        zIndex: 100000,
        backgroundColor: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)'
      }}>
        <Dialog.Title>Manage Tenant Assignments</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Assign {userEmail} to specific tenants. This user will have admin-level control within their assigned tenants.
        </Dialog.Description>

        {isLoading ? (
          <Box py="4">
            <Text align="center">Loading tenant assignments...</Text>
          </Box>
        ) : (
          <Box>
            <Text size="2" color="gray" mb="3">
              Select the tenants this user should have access to:
            </Text>
            
            <Box style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {assignments.length === 0 ? (
                <Box my="4">
                  <Text color="gray" align="center">
                    No tenants available
                  </Text>
                </Box>
              ) : (
                assignments.map((assignment) => (
                  <Flex key={assignment.tenantId} align="center" gap="3" py="2">
                    <Checkbox
                      checked={assignment.assigned}
                      onCheckedChange={(checked) => 
                        handleAssignmentChange(assignment.tenantId, checked as boolean)
                      }
                    />
                    <Text size="2">{assignment.tenantName}</Text>
                  </Flex>
                ))
              )}
            </Box>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" disabled={isSaving}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Assignments'}
              </Button>
            </Flex>
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
} 
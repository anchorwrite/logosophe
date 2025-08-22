'use client';

import { useState } from 'react';
import { Button, Flex, AlertDialog, Text, TextField, Select, Box } from '@radix-ui/themes';

interface BulkHardDeleteButtonProps {
  accessibleTenants: string[];
}

export default function BulkHardDeleteButton({ accessibleTenants }: BulkHardDeleteButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCriteria, setDeleteCriteria] = useState({
    tenantId: 'all',
    olderThanDays: 30,
    messageIds: ''
  });
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    summary?: any;
  } | null>(null);

  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true);
      setResult(null);

      const payload: any = {};
      
      if (deleteCriteria.tenantId && deleteCriteria.tenantId !== 'all') {
        payload.tenantId = deleteCriteria.tenantId;
      }
      
      if (deleteCriteria.olderThanDays > 0) {
        payload.olderThanDays = deleteCriteria.olderThanDays;
      }
      
      if (deleteCriteria.messageIds.trim()) {
        const ids = deleteCriteria.messageIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (ids.length > 0) {
          payload.messageIds = ids;
        }
      }

      const response = await fetch('/api/dashboard/messaging/messages/bulk-hard-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as { 
        message?: string; 
        error?: string;
        summary?: { 
          totalMessages: number; 
          successfullyDeleted: number; 
          errors: number; 
          totalAttachments: number; 
        } 
      };
      
      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Bulk delete completed successfully',
          summary: data.summary
        });
        // Don't reset form or close dialog yet - let user see the results
      } else {
        setResult({
          success: false,
          message: data.error || 'Unknown error occurred'
        });
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
      setResult({
        success: false,
        message: 'Error occurred during bulk delete operation'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setDeleteCriteria({
      tenantId: 'all',
      olderThanDays: 30,
      messageIds: ''
    });
    setResult(null);
  };

  return (
    <>
      <Button variant="soft" color="red" onClick={() => setShowDialog(true)}>
        Bulk Hard Delete
      </Button>

      <AlertDialog.Root open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialog.Content style={{ maxWidth: '600px' }}>
          <AlertDialog.Title>Bulk Hard Delete Soft-Deleted Messages</AlertDialog.Title>
          <AlertDialog.Description>
            This will PERMANENTLY DELETE multiple soft-deleted messages and all their data based on creation date. 
            Messages created more than the specified number of days ago will be permanently removed.
            This action cannot be undone and will remove messages completely from the system.
          </AlertDialog.Description>
          
          <Box mt="4">
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Tenant (Optional)
                </Text>
                <Select.Root 
                  value={deleteCriteria.tenantId} 
                  onValueChange={(value) => setDeleteCriteria(prev => ({ ...prev, tenantId: value }))}
                >
                  <Select.Trigger placeholder="All accessible tenants" />
                  <Select.Content>
                    <Select.Item value="all">All accessible tenants</Select.Item>
                    {accessibleTenants.map(tenantId => (
                      <Select.Item key={tenantId} value={tenantId}>
                        {tenantId}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Delete messages created more than (days) ago
                </Text>
                <TextField.Input
                  type="number"
                  min="1"
                  max="365"
                  value={deleteCriteria.olderThanDays}
                  onChange={(e) => setDeleteCriteria(prev => ({ 
                    ...prev, 
                    olderThanDays: parseInt(e.target.value) || 30 
                  }))}
                  placeholder="30"
                />
              </Box>

              <Box>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Specific Message IDs (Optional)
                </Text>
                <Text size="1" color="gray" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Comma-separated list of message IDs to delete
                </Text>
                <TextField.Input
                  value={deleteCriteria.messageIds}
                  onChange={(e) => setDeleteCriteria(prev => ({ 
                    ...prev, 
                    messageIds: e.target.value 
                  }))}
                  placeholder="123, 456, 789"
                />
              </Box>
            </Flex>
          </Box>

          {result && (
            <Box mt="4" p="3" style={{ 
              backgroundColor: result.success ? 'var(--green-3)' : 'var(--red-3)',
              borderRadius: '4px',
              border: `1px solid ${result.success ? 'var(--green-6)' : 'var(--red-6)'}`
            }}>
              <Text size="2" weight="medium" color={result.success ? 'green' : 'red'}>
                {result.message}
              </Text>
              {result.summary && (
                <Box mt="2">
                  <Text size="1" color="gray">
                    Summary: {result.summary.totalMessages} messages found, {result.summary.successfullyDeleted} deleted, 
                    {result.summary.errors} errors, {result.summary.totalAttachments} attachments removed
                  </Text>
                </Box>
              )}
            </Box>
          )}
          
          <Flex gap="3" mt="4" justify="end">
            {!result ? (
              <>
                <AlertDialog.Cancel>
                  <Button variant="soft" color="gray" onClick={resetForm}>
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <Button 
                  variant="solid" 
                  color="red" 
                  onClick={handleBulkDelete} 
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Bulk Hard Delete'}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="soft" 
                  color="gray"
                  onClick={() => {
                    setShowDialog(false);
                    setResult(null);
                    resetForm();
                  }}
                >
                  Close
                </Button>
                {result.success && (
                  <Button 
                    variant="solid" 
                    color="blue"
                    onClick={() => {
                      setResult(null);
                      resetForm();
                    }}
                  >
                    Delete More Messages
                  </Button>
                )}
              </>
            )}
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}

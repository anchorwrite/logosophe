'use client';


import { useEffect, useState } from 'react';
import { Box, Flex, Heading, Text, Card, Button, Badge, Table, Dialog } from "@radix-ui/themes";
import { Trash2, RotateCcw, Download, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface SoftDeletedFile {
  id: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  mediaType: string;
  deletedAt: string;
  deletedBy: string;
  originalUploadDate: string;
  r2Key: string;
  tenantId?: string;
  tenantName?: string;
  workflowCount: number;
}

interface SoftDeletedFilesStats {
  totalFiles: number;
  totalStorageBytes: number;
  storageByType: {
    audio: { count: number; bytes: number };
    video: { count: number; bytes: number };
    image: { count: number; bytes: number };
    document: { count: number; bytes: number };
  };
  oldestDeleted: string;
  newestDeleted: string;
  deletedByUser: Record<string, number>;
  tenantBreakdown?: Array<{
    tenantId: string;
    tenantName: string;
    fileCount: number;
    storageBytes: number;
  }>;
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function SoftDeletedFilesPage() {
  const [files, setFiles] = useState<SoftDeletedFile[]>([]);
  const [stats, setStats] = useState<SoftDeletedFilesStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const { showToast } = useToast();

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    fileId?: number;
    fileName?: string;
  }>({ isOpen: false });

  const [bulkDeleteDialog, setBulkDeleteDialog] = useState<{
    isOpen: boolean;
    fileIds: number[];
    fileCount: number;
  }>({ isOpen: false, fileIds: [], fileCount: 0 });

  const [restoreDialog, setRestoreDialog] = useState<{
    isOpen: boolean;
    fileId?: number;
    fileName?: string;
  }>({ isOpen: false });

  useEffect(() => {
    fetchSoftDeletedFiles();
  }, []);

  const fetchSoftDeletedFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/dashboard/soft-deleted-files');
      
      if (!response.ok) {
        throw new Error('Failed to fetch soft-deleted files');
      }

      const data = await response.json() as {
        files: SoftDeletedFile[];
        stats: SoftDeletedFilesStats;
        pagination: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
      };
      setFiles(data.files);
      setStats(data.stats);
      setPagination(data.pagination);
      
      // Check if user is global admin based on tenant breakdown availability
      setIsGlobalAdmin(!!data.stats.tenantBreakdown);
    } catch (error) {
      console.error('Error fetching soft-deleted files:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to load soft-deleted files'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermanentDelete = async (fileId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/dashboard/soft-deleted-files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Admin permanent deletion' })
      });

      if (!response.ok) {
        throw new Error('Failed to permanently delete file');
      }

      const result = await response.json() as { success: boolean; message: string };
      
      showToast({
        type: 'success',
        title: 'Success',
        content: `File "${fileName}" permanently deleted`
      });

      // Refresh the file list
      fetchSoftDeletedFiles();
    } catch (error) {
      console.error('Error permanently deleting file:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to permanently delete file'
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const response = await fetch('/api/dashboard/soft-deleted-files/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: bulkDeleteDialog.fileIds,
          reason: 'Bulk permanent deletion'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to bulk delete files');
      }

      const result = await response.json() as { 
        success: boolean; 
        deletedCount: number; 
        totalStorageFreed: number; 
        errors: Array<{ fileId: number; error: string }> 
      };
      
      showToast({
        type: 'success',
        title: 'Success',
        content: `Permanently deleted ${result.deletedCount} files`
      });

      // Refresh the file list
      fetchSoftDeletedFiles();
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error bulk deleting files:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to bulk delete files'
      });
    }
  };

  const handleRestore = async (fileId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/dashboard/soft-deleted-files/${fileId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to restore file');
      }

      const result = await response.json() as { 
        success: boolean; 
        message: string; 
        restoredFile: { id: number; fileName: string } 
      };
      
      showToast({
        type: 'success',
        title: 'Success',
        content: `File "${fileName}" restored successfully`
      });

      // Refresh the file list
      fetchSoftDeletedFiles();
    } catch (error) {
      console.error('Error restoring file:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to restore file'
      });
    }
  };

  const handleSelectFile = (fileId: number) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Box p="4">
        <Text>Loading soft-deleted files...</Text>
      </Box>
    );
  }

  return (
    <Box p="4">
      <Flex justify="between" align="center" mb="4">
        <Heading size="6">Soft-Deleted Files Management</Heading>
        {selectedFiles.length > 0 && (
          <Button 
            color="red" 
            onClick={() => setBulkDeleteDialog({
              isOpen: true,
              fileIds: selectedFiles,
              fileCount: selectedFiles.length
            })}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete {selectedFiles.length} Files
          </Button>
        )}
      </Flex>

      {/* Storage Overview */}
      {stats && (
        <Card mb="4">
          <Heading size="4" mb="3">Storage Overview</Heading>
          <Flex gap="4" wrap="wrap">
            <Box>
              <Text size="2" color="gray">Total Files</Text>
              <Text size="4" weight="bold">{stats.totalFiles}</Text>
            </Box>
            <Box>
              <Text size="2" color="gray">Storage Used</Text>
              <Text size="4" weight="bold">{formatFileSize(stats.totalStorageBytes)}</Text>
            </Box>
            <Box>
              <Text size="2" color="gray">Oldest Deleted</Text>
              <Text size="4" weight="bold">{formatDate(stats.oldestDeleted)}</Text>
            </Box>
            <Box>
              <Text size="2" color="gray">Newest Deleted</Text>
              <Text size="4" weight="bold">{formatDate(stats.newestDeleted)}</Text>
            </Box>
          </Flex>

          {/* Storage by Type */}
          <Box mt="4">
            <Text size="3" weight="bold" mb="2">Storage by Type</Text>
            <Flex gap="4" wrap="wrap">
              {Object.entries(stats.storageByType).map(([type, data]) => (
                <Box key={type}>
                  <Text size="2" color="gray" style={{ textTransform: 'capitalize' }}>{type}</Text>
                  <Text size="3" weight="bold">{data.count} files ({formatFileSize(data.bytes)})</Text>
                </Box>
              ))}
            </Flex>
          </Box>

          {/* Tenant Breakdown for Global Admins */}
          {isGlobalAdmin && stats.tenantBreakdown && (
            <Box mt="4">
              <Text size="3" weight="bold" mb="2">Storage by Tenant</Text>
              <Flex gap="4" wrap="wrap">
                {stats.tenantBreakdown.map((tenant, index) => (
                  <Box key={`${tenant.tenantId}-${index}`}>
                    <Text size="2" color="gray">{tenant.tenantName}</Text>
                    <Text size="3" weight="bold">{tenant.fileCount} files ({formatFileSize(tenant.storageBytes)})</Text>
                  </Box>
                ))}
              </Flex>
            </Box>
          )}
        </Card>
      )}

      {/* Files Table */}
      <Card>
        <Heading size="4" mb="3">Soft-Deleted Files</Heading>
        
        {files.length === 0 ? (
          <Text color="gray">No soft-deleted files found.</Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>
                  <input
                    type="checkbox"
                    checked={selectedFiles.length === files.length}
                    onChange={handleSelectAll}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>File Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Size</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                {isGlobalAdmin && <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>}
                <Table.ColumnHeaderCell>Deleted By</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Deleted At</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Workflows</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {files.map((file) => (
                <Table.Row key={file.id}>
                  <Table.Cell>
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => handleSelectFile(file.id)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text weight="medium">{file.fileName}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatFileSize(file.fileSize)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" style={{ textTransform: 'capitalize' }}>
                      {file.mediaType}
                    </Badge>
                  </Table.Cell>
                  {isGlobalAdmin && (
                    <Table.Cell>
                      <Text size="2">{file.tenantName || 'Unknown'}</Text>
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <Text size="2">{file.deletedBy}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatDate(file.deletedAt)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">
                      {file.workflowCount > 0 ? (
                        <Badge color="orange">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {file.workflowCount}
                        </Badge>
                      ) : (
                        '0'
                      )}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => setRestoreDialog({
                          isOpen: true,
                          fileId: file.id,
                          fileName: file.fileName
                        })}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="1"
                        color="red"
                        variant="soft"
                        onClick={() => setDeleteDialog({
                          isOpen: true,
                          fileId: file.id,
                          fileName: file.fileName
                        })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Flex justify="center" mt="4">
          <Text size="2" color="gray">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total files)
          </Text>
        </Flex>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false })}
        onConfirm={() => {
          if (deleteDialog.fileId && deleteDialog.fileName) {
            handlePermanentDelete(deleteDialog.fileId, deleteDialog.fileName);
          }
          setDeleteDialog({ isOpen: false });
        }}
        title="Permanently Delete File"
        message={`Are you sure you want to permanently delete "${deleteDialog.fileName}"? This action cannot be undone and the file will be removed from storage.`}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={bulkDeleteDialog.isOpen}
        onClose={() => setBulkDeleteDialog({ isOpen: false, fileIds: [], fileCount: 0 })}
        onConfirm={() => {
          handleBulkDelete();
          setBulkDeleteDialog({ isOpen: false, fileIds: [], fileCount: 0 });
        }}
        title="Bulk Delete Files"
        message={`Are you sure you want to permanently delete ${bulkDeleteDialog.fileCount} files? This action cannot be undone and the files will be removed from storage.`}
        confirmText="Delete All"
        cancelText="Cancel"
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={restoreDialog.isOpen}
        onClose={() => setRestoreDialog({ isOpen: false })}
        onConfirm={() => {
          if (restoreDialog.fileId && restoreDialog.fileName) {
            handleRestore(restoreDialog.fileId, restoreDialog.fileName);
          }
          setRestoreDialog({ isOpen: false });
        }}
        title="Restore File"
        message={`Are you sure you want to restore "${restoreDialog.fileName}"? The file will be available again in the media library.`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="default"
      />
    </Box>
  );
} 
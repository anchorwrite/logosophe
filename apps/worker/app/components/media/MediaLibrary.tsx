'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, TextField, Select, Button, Grid, Dialog, Checkbox } from '@radix-ui/themes';
import { Search, Download, Eye, Trash2, Share2, Users, Minus } from 'lucide-react';
import { MediaPreview } from './MediaPreview';
import { useToast } from '@/components/Toast';

interface MediaResponse {
  files: MediaFile[];
  pagination: PaginationInfo;
}

interface MediaFile {
  Id: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  TenantId: string;
  TenantName: string;
  R2Key: string;
  UploadedBy: string;
  Language?: string;
}

interface Tenant {
  TenantId: string;
  Name: string;
}

interface TenantResource {
  TenantId: string;
}

interface MediaAccess {
  TenantId: string;
}

type SortBy = 'newest' | 'oldest' | 'name' | 'size';

interface ShareLinkResponse {
  shareUrl: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface TenantResponse {
  results: Array<{
    Id: string;
    Name: string;
    Description: string;
    CreatedAt: string;
    UpdatedAt: string;
  }>;
}

interface Session {
  user?: {
    email?: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function MediaLibrary() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null
  });
  const [shareDialog, setShareDialog] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null
  });
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState<'success' | 'error'>('success');
  const [toastContent, setToastContent] = useState('');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLimitedAccess, setIsLimitedAccess] = useState(false);
  const [maxAccesses, setMaxAccesses] = useState('10');
  const [isLimitedExpiry, setIsLimitedExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState('30');
  const [showLinkResult, setShowLinkResult] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [sharePassword, setSharePassword] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(
          `/api/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch media files');
        }
        const data = await response.json() as MediaResponse;
        setFiles(data.files);
        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        console.error('Error fetching media files:', err);
        setError('Failed to load media files');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/user/tenants');
        if (!response.ok) {
          throw new Error('Failed to fetch tenants');
        }
        const data = await response.json() as Array<{ Id: string; Name: string }>;
        const validTenants = data.map(tenant => ({
          TenantId: tenant.Id,
          Name: tenant.Name
        }));
        setTenants(validTenants);
      } catch (err) {
        console.error('Error fetching tenants:', err);
        setError('Failed to load tenants');
      }
    };

    fetchFiles();
    fetchTenants();
  }, [search, type, sortBy, page, pageSize]);

  const handleDelete = async (file: MediaFile) => {
    console.log('Delete clicked for file:', file);
    setDeleteDialog({ isOpen: true, file });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.file) return;

    try {
      const response = await fetch(`/api/media/${deleteDialog.file.Id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete file');
      }

      // Remove the duplicate logging since it's already logged in the delete endpoint
      setDeleteDialog({ isOpen: false, file: null });

      // Refresh the file list with cache-busting timestamp
      const timestamp = new Date().getTime();
      const filesResponse = await fetch(`/api/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);

      setToastTitle('success');
      setToastContent('File deleted successfully');
      setToastOpen(true);
    } catch (err) {
      console.error('Error deleting file:', err);
      setToastTitle('error');
      setToastContent(err instanceof Error ? err.message : 'Failed to delete file');
      setToastOpen(true);
    }
  };

  const handleShare = async (file: MediaFile) => {
    setShareDialog({ isOpen: true, file: file });
    setSelectedTenants([]); // Start with none selected for sharing
    setIsShareDialogOpen(true);

    // Fetch current tenant access for this file
    try {
      const response = await fetch(`/api/media/${file.Id}/access`);
      if (!response.ok) {
        throw new Error('Failed to fetch current tenant access');
      }
      const data = await response.json() as MediaAccess[];
      const currentTenantIds = data.map(access => access.TenantId);
      setSelectedTenants(currentTenantIds);
    } catch (err) {
      console.error('Error fetching tenant access:', err);
      setError('Failed to load current tenant access');
    }
  };

  const handleTenantChange = (tenantId: string, currentTenants: string[]) => {
    // If the tenant is already in selectedTenants, remove it
    if (selectedTenants.includes(tenantId)) {
      setSelectedTenants(prev => prev.filter(id => id !== tenantId));
    } else {
      // Otherwise add it
      setSelectedTenants(prev => [...prev, tenantId]);
    }
  };

  const handleCreateLink = async (file: MediaFile | null) => {
    if (!file) {
      setToastTitle('error');
      setToastContent('No file selected');
      setToastOpen(true);
      return;
    }

    try {
      const requestBody = {
        expiresIn: isLimitedExpiry ? parseInt(expiryDays, 10) : null,
        maxAccesses: isLimitedAccess ? parseInt(maxAccesses, 10) : null,
        password: isPasswordProtected ? sharePassword : undefined,
      };
      console.log('Creating share link with body:', JSON.stringify(requestBody, null, 2));
      console.log('Password protection enabled:', isPasswordProtected);
      console.log('Share password:', sharePassword);

      const response = await fetch(`/api/media/${file.Id}/link`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as ErrorResponse | null;
        throw new Error(errorData?.details || errorData?.error || 'Failed to create share link');
      }

      const data = await response.json() as ShareLinkResponse;
      setShareLink(data.shareUrl);
      setIsLinkDialogOpen(false);
      setShowLinkResult(true);
    } catch (err) {
      console.error('Error creating share link:', err);
      setToastTitle('error');
      setToastContent(err instanceof Error ? err.message : 'Failed to create share link');
      setToastOpen(true);
    }
  };

  const confirmShare = async () => {
    if (!shareDialog.file) return;

    try {
      // Get current tenant access
      const response = await fetch(`/api/media/${shareDialog.file.Id}/access`);
      if (!response.ok) {
        throw new Error('Failed to fetch current tenant access');
      }
      const data = await response.json() as MediaAccess[];
      const currentTenantIds = data.map(access => access.TenantId);

      // Combine current tenants with newly selected ones
      const tenantsToUpdate = [...new Set([...currentTenantIds, ...selectedTenants])];

      // Update tenant access
      const updateResponse = await fetch(`/api/media/${shareDialog.file.Id}/access`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenants: tenantsToUpdate }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update tenant access');
      }

      // Remove the duplicate logging since it's already logged in the access endpoint
      setIsShareDialogOpen(false);
      setShareDialog({ isOpen: false, file: null });
      setSelectedTenants([]);
      
      // Refresh the file list
      const filesResponse = await fetch(`/api/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);

      // Show success toast
      setToastTitle('success');
      setToastContent('File shared successfully');
      setToastOpen(true);
    } catch (err) {
      console.error('Error updating tenant access:', err);
      setToastTitle('error');
      setToastContent(err instanceof Error ? err.message : 'Failed to update tenant access');
      setToastOpen(true);
    }
  };

  const [removeFromTenantDialog, setRemoveFromTenantDialog] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null
  });

  const handleRemoveFromTenant = async (file: MediaFile) => {
    setRemoveFromTenantDialog({ isOpen: true, file });
  };

  const confirmRemoveFromTenant = async () => {
    if (!removeFromTenantDialog.file) return;
    setRemoveFromTenantDialog({ isOpen: false, file: null });

    try {
      const response = await fetch(`/api/media/${removeFromTenantDialog.file.Id}/tenants/${removeFromTenantDialog.file.TenantId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to remove file from tenant');
      }

      // Remove the duplicate logging since it's already logged in the delete endpoint
      const filesResponse = await fetch(`/api/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);
    } catch (err) {
      console.error('Error removing file from tenant:', err);
      showToast({
        type: 'error',
        title: 'Error',
        content: err instanceof Error ? err.message : 'Failed to remove file from tenant'
      });
    }
  };

  const handleShareLink = (file: MediaFile) => {
    setDeleteDialog({ isOpen: false, file: null });
    setShareDialog({ isOpen: true, file });
    setIsLinkDialogOpen(true);
    setShowLinkResult(false);
    setShareLink(null);
    setIsPasswordProtected(false);
    setSharePassword('');
    setSelectedTenants([]);
  };

  if (isLoading) {
    return <Text align="center">Loading media files...</Text>;
  }

  if (error) {
    return <Text color="red" align="center">{error}</Text>;
  }

  return (
    <Box className="space-y-4">
      <Flex gap="4" align="center">
        <Box grow="1">
          <TextField.Root>
            <TextField.Slot>
              <Search className="h-4 w-4" />
            </TextField.Slot>
            <TextField.Input
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </TextField.Root>
        </Box>
        <Select.Root value={type} onValueChange={setType}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="type-all" value="all">All Types</Select.Item>
            <Select.Item key="type-image" value="image">Images</Select.Item>
            <Select.Item key="type-video" value="video">Videos</Select.Item>
            <Select.Item key="type-audio" value="audio">Audio</Select.Item>
            <Select.Item key="type-document" value="document">Documents</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="sort-newest" value="newest">Newest First</Select.Item>
            <Select.Item key="sort-oldest" value="oldest">Oldest First</Select.Item>
            <Select.Item key="sort-name" value="name">Name</Select.Item>
            <Select.Item key="sort-size" value="size">Size</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Size</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Uploaded By</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {files.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={7}>
                <Text align="center">No files found</Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            files.map((file) => (
              <Table.Row key={`file-row-${file.Id}-${file.TenantId}`}>
                <Table.Cell key={`file-name-${file.Id}`}>{file.FileName}</Table.Cell>
                <Table.Cell key={`file-type-${file.Id}`}>
                  <Text className="capitalize">{file.MediaType}</Text>
                </Table.Cell>
                <Table.Cell key={`file-size-${file.Id}`}>{formatBytes(file.FileSize)}</Table.Cell>
                <Table.Cell key={`file-uploaded-${file.Id}`}>
                  {new Date(file.UploadDate).toLocaleString()}
                </Table.Cell>
                <Table.Cell key={`file-uploaded-by-${file.Id}`}>
                  <Text>{file.UploadedBy}</Text>
                </Table.Cell>
                <Table.Cell key={`file-tenant-${file.Id}`}>
                  <Text>{file.TenantName}</Text>
                </Table.Cell>
                <Table.Cell key={`file-actions-${file.Id}`}>
                  <Flex gap="2" justify="end">
                    <Button
                      key={`file-view-${file.Id}`}
                      variant="soft"
                      onClick={() => window.open(`/api/media/${file.Id}/preview`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      key={`file-download-${file.Id}`}
                      variant="soft"
                      onClick={() => window.open(`/api/media/${file.Id}/download`, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      key={`file-share-${file.Id}`}
                      variant="soft"
                      onClick={() => handleShare(file)}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      key={`file-link-${file.Id}`}
                      variant="soft"
                      onClick={() => handleShareLink(file)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      key={`file-delete-${file.Id}`}
                      variant="soft"
                      color="red"
                      onClick={() => handleDelete(file)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <Flex justify="between" align="center" mt="4">
        <Flex gap="2" align="center">
          <Text size="2">
            Showing {files.length} rows of {pagination.total} unique files
          </Text>
          <Select.Root value={pageSize.toString()} onValueChange={(value) => {
            setPageSize(parseInt(value));
            setPage(1); // Reset to first page when changing page size
          }}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="10">10 per page</Select.Item>
              <Select.Item value="25">25 per page</Select.Item>
              <Select.Item value="50">50 per page</Select.Item>
              <Select.Item value="100">100 per page</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex gap="2">
          <Button
            variant="soft"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Text size="2" align="center" style={{ minWidth: '100px' }}>
            Page {page} of {pagination.totalPages}
          </Text>
          <Button
            variant="soft"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
          >
            Next
          </Button>
        </Flex>
      </Flex>

      <Dialog.Root open={isShareDialogOpen} onOpenChange={(open) => {
        setIsShareDialogOpen(open);
        if (!open) {
          setSelectedTenants([]);
        }
      }}>
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
          <Dialog.Title>Share with Tenants</Dialog.Title>
          <Dialog.Description>
            Select additional tenants that should have access to this file.
          </Dialog.Description>
          <Box className="mt-4">
            <Flex direction="column" gap="2">
              {tenants.map((tenant) => {
                const isCurrentTenant = selectedTenants.includes(tenant.TenantId);
                const wasCurrentTenant = shareDialog.file?.TenantId === tenant.TenantId;
                return (
                  <label key={`tenant-checkbox-${tenant.TenantId}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={isCurrentTenant}
                      onCheckedChange={() => handleTenantChange(tenant.TenantId, selectedTenants)}
                      disabled={wasCurrentTenant}
                    />
                    <Text size="2">
                      {tenant.Name}
                      {wasCurrentTenant && ' (Current Tenant)'}
                    </Text>
                  </label>
                );
              })}
            </Flex>
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button onClick={confirmShare}>Save Changes</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={isLinkDialogOpen} onOpenChange={(open) => {
        setIsLinkDialogOpen(open);
        if (!open) {
          setShareLink(null);
          setIsPasswordProtected(false);
          setSharePassword('');
          setSelectedTenants([]);
        }
      }}>
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
          <Dialog.Title>Create Share Link</Dialog.Title>
          <Dialog.Description>
            Configure the settings for your share link.
          </Dialog.Description>

          <Flex direction="column" gap="3" mt="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Expiration
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isLimitedExpiry ? "soft" : "solid"}
                  onClick={() => setIsLimitedExpiry(false)}
                >
                  Never Expires
                </Button>
                <Button
                  variant={isLimitedExpiry ? "solid" : "soft"}
                  onClick={() => setIsLimitedExpiry(true)}
                >
                  Expires After
                </Button>
              </Flex>
            </label>

            {isLimitedExpiry && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Days Until Expiry
                </Text>
                <TextField.Root>
                  <TextField.Input
                    type="number"
                    min="1"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                  />
                </TextField.Root>
              </label>
            )}

            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Access Limit
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isLimitedAccess ? "soft" : "solid"}
                  onClick={() => setIsLimitedAccess(false)}
                >
                  Unlimited
                </Button>
                <Button
                  variant={isLimitedAccess ? "solid" : "soft"}
                  onClick={() => setIsLimitedAccess(true)}
                >
                  Limited
                </Button>
              </Flex>
            </label>

            {isLimitedAccess && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Max Accesses
                </Text>
                <TextField.Root>
                  <TextField.Input
                    type="number"
                    min="1"
                    value={maxAccesses}
                    onChange={(e) => setMaxAccesses(e.target.value)}
                  />
                </TextField.Root>
              </label>
            )}

            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Password Protection
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isPasswordProtected ? "solid" : "soft"}
                  onClick={() => setIsPasswordProtected(true)}
                >
                  Password Protected
                </Button>
                <Button
                  variant={isPasswordProtected ? "soft" : "solid"}
                  onClick={() => setIsPasswordProtected(false)}
                >
                  No Password
                </Button>
              </Flex>
            </label>

            {isPasswordProtected && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Password
                </Text>
                <form onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    style={{ display: 'none' }}
                  />
                  <TextField.Root>
                    <TextField.Input
                      type="password"
                      placeholder="Enter password for the shared file"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </TextField.Root>
                </form>
              </label>
            )}
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button onClick={() => handleCreateLink(shareDialog.file)}>Create Link</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={showLinkResult} onOpenChange={(open) => {
        setShowLinkResult(open);
        if (!open) {
          setShareLink(null);
        }
      }}>
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
          <Dialog.Title>Share Link Created</Dialog.Title>
          <Dialog.Description>
            Your share link has been created. Copy it to share with others.
          </Dialog.Description>

          <Box className="mt-4">
            <TextField.Root>
              <TextField.Input
                value={shareLink || ''}
                readOnly
                onClick={(e) => e.currentTarget.select()}
              />
              <TextField.Slot>
                <Button
                  variant="soft"
                  onClick={() => {
                    if (shareLink) {
                      navigator.clipboard.writeText(shareLink);
                      setToastTitle('success');
                      setToastContent('Link copied to clipboard');
                      setToastOpen(true);
                    }
                  }}
                >
                  Copy
                </Button>
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ isOpen: open, file: deleteDialog.file })}>
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
          <Dialog.Title>Delete File</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete {deleteDialog.file?.FileName}? If there are no more tenants with this file, this action cannot be undone.
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={confirmDelete}>Delete</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {previewMedia && (
        <MediaPreview
          media={{
            id: previewMedia.Id,
            fileName: previewMedia.FileName,
            fileSize: previewMedia.FileSize,
            contentType: previewMedia.ContentType,
            mediaType: previewMedia.MediaType,
            uploadDate: previewMedia.UploadDate,
            description: previewMedia.Description,
            duration: previewMedia.Duration,
            width: previewMedia.Width,
            height: previewMedia.Height
          }}
          open={!!previewMedia}
          onOpenChange={(open) => !open && setPreviewMedia(null)}
        />
      )}

      {/* Remove from Tenant Confirmation Dialog */}
      <Dialog.Root open={removeFromTenantDialog.isOpen} onOpenChange={(open) => setRemoveFromTenantDialog({ isOpen: open, file: removeFromTenantDialog.file })}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>
            <Text weight="bold" color="orange">⚠️ Remove from Tenant</Text>
          </Dialog.Title>
          <Box my="4">
            <Text size="3">
              Are you sure you want to remove this file from tenant {removeFromTenantDialog.file?.TenantName}?
            </Text>
          </Box>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft">
                Cancel
              </Button>
            </Dialog.Close>
            <Button 
              variant="solid" 
              color="orange" 
              onClick={confirmRemoveFromTenant}
            >
              Remove from Tenant
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* The Toast component is now managed by useToast hook */}
    </Box>
  );
} 
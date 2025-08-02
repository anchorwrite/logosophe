'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, TextField, Select, Button, Grid, Dialog, Checkbox } from '@radix-ui/themes';
import { Search, Download, Eye, Trash2, Share2, Users, Minus, Globe, Lock } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import { supportsWatermarking } from '@/lib/watermark';

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
  IsPublished?: boolean;
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
  const { t } = useTranslation('translations');
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
  
  // Publishing state
  const [publishDialog, setPublishDialog] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null
  });
  const [publishingSettings, setPublishingSettings] = useState({
    watermark: true,
    disableCopy: true,
    disableDownload: false,
    addWatermark: true
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedStatus, setPublishedStatus] = useState<Record<string, boolean>>({});
  const [userRolesByTenant, setUserRolesByTenant] = useState<Record<string, string[]>>({});

  const canPublishInTenant = (tenantId: string | null) => {
    if (!tenantId) {
      // If no specific tenant, check if user has publisher role in any tenant
      return Object.values(userRolesByTenant).some(roles => 
        roles.includes('publisher') || roles.includes('admin')
      );
    }
    const roles = userRolesByTenant[tenantId] || [];
    return roles.includes('publisher') || roles.includes('admin');
  };

  useEffect(() => {
        const fetchUserRolesForTenant = async (tenantId: string) => {
      try {
        const response = await fetch(`/api/user/roles/${tenantId}`);
        if (response.ok) {
          const data = await response.json() as { roles?: string[] };
          setUserRolesByTenant(prev => ({ ...prev, [tenantId]: data.roles || [] }));
        }
      } catch (err) {
        console.error('Error fetching user roles:', err);
      }
    };

    const fetchFiles = async () => {
      try {
        const response = await fetch(
          `/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch media files');
        }
        const data = await response.json() as MediaResponse;
        setFiles(data.files);
        setPagination(data.pagination);
        setError(null);

        // Fetch user roles for each unique tenant in the files (excluding null)
        const uniqueTenants = [...new Set(data.files.map(file => file.TenantId).filter(id => id !== null))];
        for (const tenantId of uniqueTenants) {
          await fetchUserRolesForTenant(tenantId);
        }
        

        

      } catch (err) {
        console.error('Error fetching media files:', err);
        setError(t('harbor.media.error'));
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
  }, [search, type, sortBy, page, pageSize, t]);

  const handleDelete = async (file: MediaFile) => {
    console.log('Delete clicked for file:', file);
    setDeleteDialog({ isOpen: true, file });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.file) return;

    try {
      const response = await fetch(`/api/harbor/media/${deleteDialog.file.Id}?tenantId=${deleteDialog.file.TenantId}`, {
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

      const result = await response.json() as { success: boolean; message: string; otherTenants?: number };
      setDeleteDialog({ isOpen: false, file: null });

      // Refresh the file list with cache-busting timestamp
      const timestamp = new Date().getTime();
      const filesResponse = await fetch(`/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}&_t=${timestamp}`, {
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

      // Show appropriate success message
      const message = result.otherTenants && result.otherTenants > 0 
        ? `File removed from tenant (still available in ${result.otherTenants} other tenant${result.otherTenants > 1 ? 's' : ''})`
        : 'File deleted completely';
      
      showToast({
        type: 'success',
        title: 'Success',
        content: message
      });
    } catch (err) {
      console.error('Error deleting file:', err);
              showToast({
          type: 'error',
          title: 'Error',
          content: err instanceof Error ? err.message : 'Failed to delete file'
        });
    }
  };

  const handleShare = async (file: MediaFile) => {
    setShareDialog({ isOpen: true, file: file });
    setSelectedTenants([]); // Start with none selected for sharing
    setIsShareDialogOpen(true);

    // Fetch current tenant access for this file
    try {
      const response = await fetch(`/api/harbor/media/${file.Id}/access`);
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
      showToast({
        type: 'error',
        title: 'Error',
        content: 'No file selected'
      });
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

      const response = await fetch(`/api/harbor/media/${file.Id}/link`, {
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
              showToast({
          type: 'error',
          title: 'Error',
          content: err instanceof Error ? err.message : 'Failed to create share link'
        });
    }
  };

  const confirmShare = async () => {
    if (!shareDialog.file) return;

    try {
      // Get current tenant access
      const response = await fetch(`/api/harbor/media/${shareDialog.file.Id}/access`);
      if (!response.ok) {
        throw new Error('Failed to fetch current tenant access');
      }
      const data = await response.json() as MediaAccess[];
      const currentTenantIds = data.map(access => access.TenantId);

      // Combine current tenants with newly selected ones
      const tenantsToUpdate = [...new Set([...currentTenantIds, ...selectedTenants])];

      // Update tenant access
      const updateResponse = await fetch(`/api/harbor/media/${shareDialog.file.Id}/access`, {
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
      const filesResponse = await fetch(`/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);

      // Show success toast
              showToast({
          type: 'success',
          title: 'Success',
          content: 'File shared successfully'
        });
    } catch (err) {
      console.error('Error updating tenant access:', err);
              showToast({
          type: 'error',
          title: 'Error',
          content: err instanceof Error ? err.message : 'Failed to update tenant access'
        });
    }
  };

  const handleRemoveFromTenant = async (file: MediaFile) => {
    if (!confirm(`Are you sure you want to remove this file from tenant ${file.TenantId}?`)) return;

    try {
      const response = await fetch(`/api/harbor/media/${file.Id}/tenants/${file.TenantId}`, {
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
      const filesResponse = await fetch(`/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);
      
      // Show success toast
      showToast({
        type: 'success',
        title: 'Success',
        content: 'File removed from tenant successfully'
      });
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

  const handlePublish = async (file: MediaFile) => {
    setPublishDialog({ isOpen: true, file });
    // Reset publishing settings to defaults
    setPublishingSettings({
      watermark: supportsWatermarking(file.MediaType, file.ContentType),
      disableCopy: true,
      disableDownload: false,
      addWatermark: true
    });
  };

  const handleUnpublish = async (file: MediaFile) => {
    if (!confirm(t('harbor.media.unpublishConfirm'))) return;

    try {
      setIsPublishing(true);
      const response = await fetch(`/api/harbor/media/${file.Id}/publish`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to unpublish content';
        
        try {
          const errorData = await response.json() as ErrorResponse | null;
          if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (errorData?.details) {
            errorMessage = errorData.details;
          }
        } catch (parseError) {
          // If JSON parsing fails, use status-based messages
          if (response.status === 403) {
            errorMessage = 'You do not have permission to unpublish content. Please contact an administrator to assign you the publisher role.';
          } else if (response.status === 401) {
            errorMessage = 'You must be logged in to unpublish content.';
          } else if (response.status === 404) {
            errorMessage = 'The published content was not found.';
          }
        }
        
        throw new Error(errorMessage);
      }

      // Update published status
      // Update the file's published status in the local state
      setFiles(prev => prev.map(f => 
        f.Id === file.Id ? { ...f, IsPublished: false } : f
      ));
      
      showToast({
        type: 'success',
        title: 'Success',
        content: t('harbor.media.unpublishedSuccess')
      });

      // Refresh the file list
      const filesResponse = await fetch(`/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);

    } catch (err) {
      console.error('Error unpublishing content:', err);
      showToast({
        type: 'error',
        title: 'Error',
        content: err instanceof Error ? err.message : 'Failed to unpublish content'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const confirmPublish = async () => {
    if (!publishDialog.file) return;

    try {
      setIsPublishing(true);
      const response = await fetch(`/api/harbor/media/${publishDialog.file.Id}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publishingSettings
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to publish content';
        
        try {
          const errorData = await response.json() as ErrorResponse | null;
          if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (errorData?.details) {
            errorMessage = errorData.details;
          }
        } catch (parseError) {
          // If JSON parsing fails, use status-based messages
          if (response.status === 403) {
            errorMessage = 'You do not have permission to publish content. Please contact an administrator to assign you the publisher role.';
          } else if (response.status === 401) {
            errorMessage = 'You must be logged in to publish content.';
          } else if (response.status === 404) {
            errorMessage = 'The file you are trying to publish was not found.';
          } else if (response.status === 409) {
            errorMessage = 'This content is already published.';
          }
        }
        
        throw new Error(errorMessage);
      }

      // Update published status
              // Update the file's published status in the local state
        setFiles(prev => prev.map(f => 
          f.Id === publishDialog.file!.Id ? { ...f, IsPublished: true } : f
        ));
      
      showToast({
        type: 'success',
        title: 'Success',
        content: t('harbor.media.publishedSuccess')
      });

      // Refresh the file list
      const filesResponse = await fetch(`/api/harbor/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`);
      if (!filesResponse.ok) {
        throw new Error('Failed to refresh file list');
      }
      const updatedData = await filesResponse.json() as MediaResponse;
      setFiles(updatedData.files);
      setPagination(updatedData.pagination);

      setPublishDialog({ isOpen: false, file: null });

    } catch (err) {
      console.error('Error publishing content:', err);
      showToast({
        type: 'error',
        title: 'Error',
        content: err instanceof Error ? err.message : 'Failed to publish content'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return <Text align="center">{t('harbor.media.loading')}</Text>;
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
              placeholder={t('harbor.media.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </TextField.Root>
        </Box>
        <Select.Root value={type} onValueChange={setType}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="type-all" value="all">{t('harbor.media.allTypes')}</Select.Item>
            <Select.Item key="type-image" value="image">{t('harbor.media.images')}</Select.Item>
            <Select.Item key="type-video" value="video">{t('harbor.media.videos')}</Select.Item>
            <Select.Item key="type-audio" value="audio">{t('harbor.media.audio')}</Select.Item>
            <Select.Item key="type-document" value="document">{t('harbor.media.documents')}</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="sort-newest" value="newest">{t('harbor.media.newestFirst')}</Select.Item>
            <Select.Item key="sort-oldest" value="oldest">{t('harbor.media.oldestFirst')}</Select.Item>
            <Select.Item key="sort-name" value="name">{t('harbor.media.name')}</Select.Item>
            <Select.Item key="sort-size" value="size">{t('harbor.media.size')}</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t('harbor.media.name')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('harbor.media.type')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('harbor.media.size')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('harbor.media.uploaded')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('harbor.media.tenant')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('harbor.media.actions')}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {files.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text align="center">{t('harbor.media.noFilesFound')}</Text>
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
                    {file.IsPublished ? (
                      canPublishInTenant(file.TenantId) && (
                        <Button
                          key={`file-unpublish-${file.Id}`}
                          variant="soft"
                          color="orange"
                          onClick={() => handleUnpublish(file)}
                          disabled={isPublishing}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )
                    ) : (
                      canPublishInTenant(file.TenantId) && (
                        <Button
                          key={`file-publish-${file.Id}`}
                          variant="soft"
                          color="green"
                          onClick={() => handlePublish(file)}
                          disabled={isPublishing}
                        >
                          <Globe className="h-4 w-4" />
                        </Button>
                      )
                    )}
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
            {t('harbor.showing')} {files.length} {t('harbor.rowsOf')} {pagination.total} {t('harbor.uniqueFiles')}
          </Text>
          <Select.Root value={pageSize.toString()} onValueChange={(value) => {
            setPageSize(parseInt(value));
            setPage(1); // Reset to first page when changing page size
          }}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="10">10 {t('harbor.perPage')}</Select.Item>
              <Select.Item value="25">25 {t('harbor.perPage')}</Select.Item>
              <Select.Item value="50">50 {t('harbor.perPage')}</Select.Item>
              <Select.Item value="100">100 {t('harbor.perPage')}</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex gap="2">
          <Button
            variant="soft"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            {t('harbor.previous')}
          </Button>
          <Text size="2" align="center" style={{ minWidth: '100px' }}>
            {t('harbor.page')} {page} {t('harbor.of')} {pagination.totalPages}
          </Text>
          <Button
            variant="soft"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
          >
            {t('harbor.next')}
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
          <Dialog.Title>{t('harbor.media.shareWithTenants')}</Dialog.Title>
          <Dialog.Description>
                          {t('harbor.media.selectAdditionalTenants')}
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
              <Button variant="soft">{t('common.cancel')}</Button>
            </Dialog.Close>
            <Button onClick={confirmShare}>{t('harbor.media.save')}</Button>
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
          <Dialog.Title>{t('harbor.media.createShareLink')}</Dialog.Title>
          <Dialog.Description>
                          {t('harbor.media.configureShareLink')}
          </Dialog.Description>

          <Flex direction="column" gap="3" mt="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                {t('harbor.media.expiration')}
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isLimitedExpiry ? "soft" : "solid"}
                  onClick={() => setIsLimitedExpiry(false)}
                >
                  {t('harbor.media.neverExpires')}
                </Button>
                <Button
                  variant={isLimitedExpiry ? "solid" : "soft"}
                  onClick={() => setIsLimitedExpiry(true)}
                >
                  {t('harbor.media.expiresAfter')}
                </Button>
              </Flex>
            </label>

            {isLimitedExpiry && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t('harbor.media.daysUntilExpiry')}
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
                {t('harbor.media.accessLimit')}
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isLimitedAccess ? "soft" : "solid"}
                  onClick={() => setIsLimitedAccess(false)}
                >
                  {t('harbor.media.unlimited')}
                </Button>
                <Button
                  variant={isLimitedAccess ? "solid" : "soft"}
                  onClick={() => setIsLimitedAccess(true)}
                >
                  {t('harbor.media.limited')}
                </Button>
              </Flex>
            </label>

            {isLimitedAccess && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t('harbor.media.maxAccesses')}
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
                {t('harbor.media.passwordProtection')}
              </Text>
              <Flex gap="2" align="center">
                <Button
                  variant={isPasswordProtected ? "solid" : "soft"}
                  onClick={() => setIsPasswordProtected(true)}
                >
                  {t('harbor.media.passwordProtected')}
                </Button>
                <Button
                  variant={isPasswordProtected ? "soft" : "solid"}
                  onClick={() => setIsPasswordProtected(false)}
                >
                  {t('harbor.media.noPassword')}
                </Button>
              </Flex>
            </label>

            {isPasswordProtected && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t('harbor.media.password')}
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
                      placeholder={t('harbor.media.enterPasswordForSharedFile')}
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
              <Button variant="soft">{t('common.cancel')}</Button>
            </Dialog.Close>
                            <Button onClick={() => handleCreateLink(shareDialog.file)}>{t('harbor.media.createLink')}</Button>
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
          <Dialog.Title>{t('harbor.media.shareLinkCreated')}</Dialog.Title>
          <Dialog.Description>
                          {t('harbor.media.shareLinkCreated')}
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
                      showToast({
                        type: 'success',
                        title: 'Success',
                        content: 'Link copied to clipboard'
                      });
                    }
                  }}
                >
                  {t('harbor.media.copy')}
                </Button>
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">{t('harbor.media.close')}</Button>
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
          <Dialog.Title>{t('harbor.media.deleteFile')}</Dialog.Title>
          <Dialog.Description>
            {deleteDialog.file ? 
              `Are you sure you want to delete ${deleteDialog.file.FileName}? If there are no more tenants with this file, this action cannot be undone.`
              : 'Are you sure you want to delete this file? If there are no more tenants with this file, this action cannot be undone.'
            }
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">{t('harbor.media.cancel')}</Button>
            </Dialog.Close>
            <Button color="red" onClick={confirmDelete}>{t('harbor.media.delete')}</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={publishDialog.isOpen} onOpenChange={(open) => setPublishDialog({ isOpen: open, file: publishDialog.file })}>
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
          <Dialog.Title>{t('harbor.media.publishContent')}</Dialog.Title>
          <Dialog.Description>
            {publishDialog.file ? 
              `Publish ${publishDialog.file.FileName} (uploaded at ${new Date(publishDialog.file.UploadDate).toLocaleString()}) to make it available to subscribers with protection settings.`
              : 'Publish content to make it available to subscribers with protection settings.'
            }
          </Dialog.Description>
          
          <Box className="mt-4">
            <Text size="2" weight="bold" mb="2">{t('harbor.media.protectionSettings')}</Text>
            
            <Flex direction="column" gap="3">
              {/* Only show watermark option for images and PDFs */}
              {publishDialog.file && supportsWatermarking(publishDialog.file.MediaType, publishDialog.file.ContentType) && (
                <label>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={publishingSettings.watermark}
                      onCheckedChange={(checked) => setPublishingSettings(prev => ({ ...prev, watermark: checked as boolean }))}
                    />
                    <Text size="2">{t('harbor.media.addWatermark')}</Text>
                  </Flex>
                </label>
              )}
              
              <label>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={publishingSettings.disableCopy}
                    onCheckedChange={(checked) => setPublishingSettings(prev => ({ ...prev, disableCopy: checked as boolean }))}
                  />
                  <Text size="2">{t('harbor.media.disableCopy')}</Text>
                </Flex>
              </label>
              
              <label>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={publishingSettings.disableDownload}
                    onCheckedChange={(checked) => setPublishingSettings(prev => ({ ...prev, disableDownload: checked as boolean }))}
                  />
                  <Text size="2">{t('harbor.media.disableDownload')}</Text>
                </Flex>
              </label>
            </Flex>
          </Box>
          
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">{t('harbor.media.cancel')}</Button>
            </Dialog.Close>
            <Button 
              color="green" 
              onClick={confirmPublish}
              disabled={isPublishing}
            >
              {isPublishing ? t('harbor.media.publishing') : t('harbor.media.publish')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>



    </Box>
  );
} 
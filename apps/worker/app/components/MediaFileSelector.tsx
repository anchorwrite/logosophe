'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, TextField, Select, Button, Grid, Dialog, Checkbox, Heading } from '@radix-ui/themes';
import { Search, Eye, Download } from 'lucide-react';
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
}

type SortBy = 'newest' | 'oldest' | 'name' | 'size';

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MediaFileSelectorProps {
  userEmail: string;
  userTenantId: string;
  selectedFiles: number[];
  onSelectionChange: (fileIds: number[]) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function MediaFileSelector({ 
  userEmail, 
  userTenantId, 
  selectedFiles, 
  onSelectionChange, 
  onClose 
}: MediaFileSelectorProps) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0
  });

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(
          `/api/media?search=${search}&type=${type}&sortBy=${sortBy}&page=${page}&pageSize=${pageSize}&uploadedBy=${encodeURIComponent(userEmail)}`
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

    fetchFiles();
  }, [search, type, sortBy, page, pageSize, userEmail]);

  const handleFileToggle = (fileId: number) => {
    const newSelection = selectedFiles.includes(fileId)
      ? selectedFiles.filter(id => id !== fileId)
      : [...selectedFiles, fileId];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allFileIds = files.map(f => parseInt(f.Id));
    onSelectionChange(allFileIds);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  const handlePreview = (file: MediaFile) => {
    window.open(`/api/media/${file.Id}/preview`, '_blank');
  };

  const handleDownload = (file: MediaFile) => {
    window.open(`/api/media/${file.Id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>Loading media files...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="3">Select Media Files</Heading>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="2" variant="soft" onClick={handleSelectNone}>
            Select None
          </Button>
          <Button size="2" onClick={onClose}>
            Done
          </Button>
        </Flex>
      </Flex>

      {/* Search and Filter Controls */}
      <Flex gap="4" align="center" mb="4">
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

      {/* Files Table */}
      <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: '50px' }}></Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Size</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Uploaded By</Table.ColumnHeaderCell>
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
              files.map((file) => {
                const isSelected = selectedFiles.includes(parseInt(file.Id));
                
                return (
                  <Table.Row key={`${file.TenantId}-${file.Id}`}>
                    <Table.Cell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleFileToggle(parseInt(file.Id))}
                      />
                    </Table.Cell>
                    <Table.Cell>{file.FileName}</Table.Cell>
                    <Table.Cell>
                      <Text className="capitalize">{file.MediaType}</Text>
                    </Table.Cell>
                    <Table.Cell>{formatBytes(file.FileSize)}</Table.Cell>
                    <Table.Cell>
                      {new Date(file.UploadDate).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      {file.UploadedBy}
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" justify="end">
                        <Button
                          variant="soft"
                          size="1"
                          onClick={() => handlePreview(file)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="soft"
                          size="1"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Pagination */}
      <Flex justify="between" align="center" mt="4">
        <Flex gap="2" align="center">
          <Text size="2">
            Showing {files.length} rows of {pagination.total} files
          </Text>
          <Select.Root value={pageSize.toString()} onValueChange={(value) => {
            setPageSize(parseInt(value));
            setPage(1);
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
            size="2"
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
            size="2"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
          >
            Next
          </Button>
        </Flex>
      </Flex>

    </Box>
  );
} 
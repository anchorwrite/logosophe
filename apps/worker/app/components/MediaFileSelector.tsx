'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, TextField, Select, Button, Grid, Dialog, Checkbox, Heading } from '@radix-ui/themes';
import { Search, Eye, Download } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

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
  lang?: string;
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
  onClose,
  lang
}: MediaFileSelectorProps) {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation('translations');
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

  // Ensure language is synchronized
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

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
        setError(t('workflow.mediaFileSelector.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [search, type, sortBy, page, pageSize, userEmail, t]);

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
        <Text>{t('workflow.mediaFileSelector.loading')}</Text>
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
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={handleSelectAll}>
            {t('workflow.mediaFileSelector.selectAll')}
          </Button>
          <Button size="2" variant="soft" onClick={handleSelectNone}>
            {t('workflow.mediaFileSelector.selectNone')}
          </Button>
          <Button size="2" onClick={onClose}>
            {t('workflow.mediaFileSelector.done')}
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
              placeholder={t('workflow.mediaFileSelector.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </TextField.Root>
        </Box>
        <Select.Root value={type} onValueChange={setType}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="type-all" value="all">{t('workflow.mediaFileSelector.allTypes')}</Select.Item>
            <Select.Item key="type-image" value="image">{t('workflow.mediaFileSelector.images')}</Select.Item>
            <Select.Item key="type-video" value="video">{t('workflow.mediaFileSelector.videos')}</Select.Item>
            <Select.Item key="type-audio" value="audio">{t('workflow.mediaFileSelector.audio')}</Select.Item>
            <Select.Item key="type-document" value="document">{t('workflow.mediaFileSelector.documents')}</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="sort-newest" value="newest">{t('workflow.mediaFileSelector.newestFirst')}</Select.Item>
            <Select.Item key="sort-oldest" value="oldest">{t('workflow.mediaFileSelector.oldestFirst')}</Select.Item>
            <Select.Item key="sort-name" value="name">{t('workflow.mediaFileSelector.name')}</Select.Item>
            <Select.Item key="sort-size" value="size">{t('workflow.mediaFileSelector.size')}</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {/* Files Table */}
      <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: '50px' }}></Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.name')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.type')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.size')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.uploaded')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.uploadedBy')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('workflow.mediaFileSelector.actions')}</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {files.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Text align="center">{t('workflow.mediaFileSelector.noFiles')}</Text>
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
            {t('workflow.mediaFileSelector.showingRows', { count: files.length, total: pagination.total })}
          </Text>
          <Select.Root value={pageSize.toString()} onValueChange={(value) => {
            setPageSize(parseInt(value));
            setPage(1);
          }}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="10">10 {t('workflow.mediaFileSelector.perPage')}</Select.Item>
              <Select.Item value="25">25 {t('workflow.mediaFileSelector.perPage')}</Select.Item>
              <Select.Item value="50">50 {t('workflow.mediaFileSelector.perPage')}</Select.Item>
              <Select.Item value="100">100 {t('workflow.mediaFileSelector.perPage')}</Select.Item>
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
            {t('workflow.mediaFileSelector.previous')}
          </Button>
          <Text size="2" align="center" style={{ minWidth: '100px' }}>
            {t('workflow.mediaFileSelector.page')} {page} {t('workflow.mediaFileSelector.of')} {pagination.totalPages}
          </Text>
          <Button
            variant="soft"
            size="2"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
          >
            {t('workflow.mediaFileSelector.next')}
          </Button>
        </Flex>
      </Flex>

    </Box>
  );
} 
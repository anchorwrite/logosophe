'use client';

import { useEffect, useState } from 'react';
import { Table, Box, Flex, Text, TextField, Select, Button, Grid, Dialog, Checkbox, Heading, Badge } from '@radix-ui/themes';
import { Search, Eye, Link, FileText, Image, Video, Music } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface PublishedContent {
  id: number;
  mediaId: number;
  title: string;
  description: string;
  mediaType: string;
  fileSize: number;
  language: string;
  form: string;
  genre: string;
  publisher: {
    email: string;
    name: string;
  };
  publishedAt: string;
  accessToken: string;
}

interface ContentResponse {
  data: PublishedContent[];
  success: boolean;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

type SortBy = 'newest' | 'oldest' | 'title' | 'size' | 'publisher';

interface ContentSelectorProps {
  selectedContent: PublishedContent[];
  onSelectionChange: (content: PublishedContent[]) => void;
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

function getMediaTypeIcon(mediaType: string) {
  if (mediaType.startsWith('image/')) return <Image size={16} />;
  if (mediaType.startsWith('video/')) return <Video size={16} />;
  if (mediaType.startsWith('audio/')) return <Music size={16} />;
  return <FileText size={16} />;
}

export default function ContentSelector({ 
  selectedContent, 
  onSelectionChange, 
  onClose,
  lang
}: ContentSelectorProps) {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation('translations');
  const [content, setContent] = useState<PublishedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState('all');
  const [genre, setGenre] = useState('all');
  const [language, setLanguage] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
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
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          q: search,
          limit: pageSize.toString(),
          offset: ((page - 1) * pageSize).toString()
        });
        
        const response = await fetch(`/api/harbor/content/search?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch published content');
        }
        
        const data: ContentResponse = await response.json();
        if (data.success) {
          setContent(data.data);
          // For now, we'll use a simple pagination since the API doesn't return pagination info yet
          // In the future, we can enhance the API to return proper pagination
          setPagination({
            total: data.data.length,
            page: 1,
            pageSize: pageSize,
            totalPages: 1
          });
        } else {
          throw new Error(data.error || 'Failed to fetch content');
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching published content:', err);
        setError('Failed to load published content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [search, form, genre, language, sortBy, page, pageSize, lang]);

  const handleContentToggle = (contentItem: PublishedContent) => {
    const isSelected = selectedContent.some(c => c.id === contentItem.id);
    const newSelection = isSelected
      ? selectedContent.filter(c => c.id !== contentItem.id)
      : [...selectedContent, contentItem];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange([...content]);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  const handlePreview = (contentItem: PublishedContent) => {
    window.open(`/content/${contentItem.accessToken}/view`, '_blank');
  };

  const handleViewDetails = (contentItem: PublishedContent) => {
    window.open(`/content/${contentItem.accessToken}/view`, '_blank');
  };

  if (isLoading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>{t('common.loading')}</Text>
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
              placeholder={t('subscriber_pages.content_linker.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </TextField.Root>
        </Box>
        <Select.Root value={form} onValueChange={setForm}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="form-all" value="all">{t('content.allForms')}</Select.Item>
            <Select.Item key="form-poetry" value="poetry">Poetry</Select.Item>
            <Select.Item key="form-novel" value="novel">Novel</Select.Item>
            <Select.Item key="form-short-story" value="short-story">Short Story</Select.Item>
            <Select.Item key="form-essay" value="essay">Essay</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={genre} onValueChange={setGenre}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="genre-all" value="all">{t('content.allGenres')}</Select.Item>
            <Select.Item key="genre-literary" value="literary">Literary</Select.Item>
            <Select.Item key="genre-science-fiction" value="science-fiction">Science Fiction</Select.Item>
            <Select.Item key="genre-romance" value="romance">Romance</Select.Item>
            <Select.Item key="genre-mystery" value="mystery">Mystery</Select.Item>
            <Select.Item key="genre-fantasy" value="fantasy">Fantasy</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={language} onValueChange={setLanguage}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="lang-all" value="all">{t('content.allLanguages')}</Select.Item>
            <Select.Item key="lang-en" value="en">English</Select.Item>
            <Select.Item key="lang-es" value="es">Español</Select.Item>
            <Select.Item key="lang-fr" value="fr">Français</Select.Item>
            <Select.Item key="lang-de" value="de">Deutsch</Select.Item>
            <Select.Item key="lang-nl" value="nl">Nederlands</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item key="sort-newest" value="newest">{t('content.newest')}</Select.Item>
            <Select.Item key="sort-oldest" value="oldest">{t('content.oldest')}</Select.Item>
            <Select.Item key="sort-title" value="title">{t('content.name')}</Select.Item>
            <Select.Item key="sort-size" value="size">{t('content.size')}</Select.Item>
            <Select.Item key="sort-publisher" value="publisher">Publisher</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {/* Content Table */}
      <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: '50px' }}></Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('content.name')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('content.size')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Form</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Genre</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Language</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Publisher</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Published</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {content.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={10}>
                  <Text align="center">{t('subscriber_pages.content_linker.no_results')}</Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              content.map((contentItem) => {
                const isSelected = selectedContent.some(c => c.id === contentItem.id);
                
                return (
                  <Table.Row key={contentItem.id}>
                    <Table.Cell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleContentToggle(contentItem)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium">{contentItem.title}</Text>
                        {contentItem.description && (
                          <Text size="1" color="gray" style={{ display: 'block', marginTop: '2px' }}>
                            {contentItem.description.length > 60 
                              ? `${contentItem.description.substring(0, 60)}...` 
                              : contentItem.description
                            }
                          </Text>
                        )}
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" gap="1">
                        {getMediaTypeIcon(contentItem.mediaType)}
                        <Text size="1" className="capitalize">
                          {contentItem.mediaType.split('/')[1] || contentItem.mediaType}
                        </Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{formatBytes(contentItem.fileSize)}</Table.Cell>
                    <Table.Cell>
                      {contentItem.form && (
                        <Badge color="blue" size="1">{contentItem.form}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {contentItem.genre && (
                        <Badge color="green" size="1">{contentItem.genre}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="orange" size="1">{contentItem.language.toUpperCase()}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1">{contentItem.publisher.name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1">{new Date(contentItem.publishedAt).toLocaleDateString()}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" justify="end">
                        <Button
                          variant="soft"
                          size="1"
                          onClick={() => handleViewDetails(contentItem)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="soft"
                          size="1"
                          onClick={() => handlePreview(contentItem)}
                        >
                          <Link className="h-3 w-3" />
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
            {t('workflow.mediaFileSelector.showingRows', { count: content.length, total: pagination.total })}
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

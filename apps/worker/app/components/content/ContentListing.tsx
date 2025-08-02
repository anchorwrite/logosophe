'use client';

import { useEffect, useState } from 'react';
import { Box, Flex, Text, TextField, Select, Button, Grid, Card, Badge } from '@radix-ui/themes';
import { Search, Download, Eye, Filter, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PublishedContent {
  Id: string;
  MediaId: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  Language?: string;
  FormId?: string;
  GenreId?: string;
  FormName?: string;
  GenreName?: string;
  PublisherId: string;
  PublishedAt: string;
  PublishingSettings: string;
  AccessToken?: string;
}

interface ContentResponse {
  content: PublishedContent[];
  pagination: PaginationInfo;
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Form {
  Id: string;
  Name: string;
  Description?: string;
}

interface Genre {
  Id: string;
  Name: string;
  Description?: string;
}

type SortBy = 'newest' | 'oldest' | 'name' | 'size';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

interface ContentListingProps {
  lang: string;
}

export function ContentListing({ lang }: ContentListingProps) {
  const { t } = useTranslation('translations');
  const [content, setContent] = useState<PublishedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [form, setForm] = useState('all');
  const [genre, setGenre] = useState('all');
  const [language, setLanguage] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 12,
    totalPages: 0
  });
  const [forms, setForms] = useState<Form[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          search,
          type,
          form,
          genre,
          language,
          sortBy,
          page: page.toString(),
          pageSize: pageSize.toString(),
        });

        const response = await fetch(`/api/content?${params}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ContentResponse = await response.json();
        setContent(data.content);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchForms = async () => {
      try {
        const response = await fetch('/api/content/forms');
        if (response.ok) {
          const data = await response.json() as { forms: Form[] };
          setForms(data.forms || []);
        }
      } catch (err) {
        console.error('Error fetching forms:', err);
      }
    };

    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/content/genres');
        if (response.ok) {
          const data = await response.json() as { genres: Genre[] };
          setGenres(data.genres || []);
        }
      } catch (err) {
        console.error('Error fetching genres:', err);
      }
    };

    fetchContent();
    fetchForms();
    fetchGenres();
  }, [search, type, form, genre, language, sortBy, page, pageSize]);

  const handleView = (content: PublishedContent) => {
    if (content.AccessToken) {
      // Direct view - open PDF in browser
      window.open(`/api/content/${content.AccessToken}/preview`, '_blank');
    } else {
      console.error('No access token available for content:', content.Id);
    }
  };

  const handleDetails = (content: PublishedContent) => {
    if (content.AccessToken) {
      // Details page - show metadata and protection info
      window.open(`/${lang}/content/${content.AccessToken}/view`, '_blank');
    } else {
      console.error('No access token available for content:', content.Id);
    }
  };

  const handleDownload = (content: PublishedContent) => {
    if (content.AccessToken) {
      // Create a temporary link element to trigger download without opening a tab
      const downloadUrl = `/api/content/${content.AccessToken}/download`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = content.FileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error('No access token available for content:', content.Id);
    }
  };



  const getMediaTypeColor = (mediaType: string) => {
    switch (mediaType) {
      case 'image': return 'blue';
      case 'video': return 'red';
      case 'audio': return 'green';
      case 'document': return 'orange';
      default: return 'gray';
    }
  };

  if (error) {
    return (
      <Box p="4">
        <Text color="red">{t('content.errorLoading')}</Text>
      </Box>
    );
  }

  return (
    <Box p="4">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box style={{ textAlign: 'center' }} mb="6">
          <Text size="6" weight="bold" mb="3" style={{ display: 'block' }}>
            {t('content.publishedContent')}
          </Text>
          <Text color="gray" size="3" style={{ display: 'block' }}>
            {t('content.discoverContent')}
          </Text>
        </Box>

        {/* Filters */}
        <Card>
          <Box p="4">
            <Flex gap="3" wrap="wrap" align="center" justify="center">
            <TextField.Root size="2">
              <TextField.Slot>
                <Search size="16" />
              </TextField.Slot>
              <TextField.Input 
                placeholder={t('content.searchPlaceholder')}
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
              />
            </TextField.Root>

            <Select.Root value={type} onValueChange={setType}>
              <Select.Trigger placeholder={t('content.selectType')} />
              <Select.Content>
                <Select.Item value="all">{t('content.allTypes')}</Select.Item>
                <Select.Item value="document">{t('content.documents')}</Select.Item>
                <Select.Item value="image">{t('content.images')}</Select.Item>
                <Select.Item value="video">{t('content.videos')}</Select.Item>
                <Select.Item value="audio">{t('content.audio')}</Select.Item>
              </Select.Content>
            </Select.Root>

            <Select.Root value={form} onValueChange={setForm}>
              <Select.Trigger placeholder={t('content.selectForm')} />
              <Select.Content>
                <Select.Item value="all">{t('content.allForms')}</Select.Item>
                {forms.map((f) => (
                  <Select.Item key={f.Id} value={f.Id}>{f.Name}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <Select.Root value={genre} onValueChange={setGenre}>
              <Select.Trigger placeholder={t('content.selectGenre')} />
              <Select.Content>
                <Select.Item value="all">{t('content.allGenres')}</Select.Item>
                {genres.map((g) => (
                  <Select.Item key={g.Id} value={g.Id}>{g.Name}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <Select.Root value={language} onValueChange={setLanguage}>
              <Select.Trigger placeholder={t('content.selectLanguage')} />
              <Select.Content>
                <Select.Item value="all">{t('content.allLanguages')}</Select.Item>
                <Select.Item value="en">English</Select.Item>
                <Select.Item value="de">Deutsch</Select.Item>
                <Select.Item value="es">Español</Select.Item>
                <Select.Item value="fr">Français</Select.Item>
                <Select.Item value="nl">Nederlands</Select.Item>
              </Select.Content>
            </Select.Root>

            <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <Select.Trigger placeholder={t('content.sortBy')} />
              <Select.Content>
                <Select.Item value="newest">{t('content.newest')}</Select.Item>
                <Select.Item value="oldest">{t('content.oldest')}</Select.Item>
                <Select.Item value="name">{t('content.name')}</Select.Item>
                <Select.Item value="size">{t('content.size')}</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
            </Box>
        </Card>

        {/* Content Grid */}
        {isLoading ? (
          <Flex justify="center" p="4">
            <Text>{t('content.loading')}</Text>
          </Flex>
        ) : content.length === 0 ? (
          <Flex justify="center" p="4">
            <Text color="gray">{t('content.noContent')}</Text>
          </Flex>
        ) : (
          <>
            <Grid columns={{ initial: "1", sm: "2", md: "3", lg: "4" }} gap="4">
              {content.map((item) => (
                <Card key={item.Id}>
                  <Box p="3">
                    <Flex direction="column" gap="3">
                      {/* Content Type Badge */}
                      <Flex justify="between" align="center">
                        <Badge color={getMediaTypeColor(item.MediaType)}>
                          {t(`content.${item.MediaType}`)}
                        </Badge>
                        {item.Language && item.Language !== 'en' && (
                          <Badge variant="soft">{item.Language.toUpperCase()}</Badge>
                        )}
                      </Flex>

                      {/* Title */}
                      <Text weight="bold" size="3" style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {item.FileName}
                      </Text>

                      {/* Metadata */}
                      <Flex direction="column" gap="1">
                        <Text size="1" color="gray">
                          {formatBytes(item.FileSize)} • {formatDate(item.PublishedAt)}
                        </Text>
                        {item.FormName && (
                          <Text size="1" color="gray">{item.FormName}</Text>
                        )}
                        {item.GenreName && (
                          <Text size="1" color="gray">{item.GenreName}</Text>
                        )}
                      </Flex>

                      {/* Action Buttons */}
                      <Flex gap="2" mt="2">
                        <Button 
                          size="1" 
                          variant="soft" 
                          onClick={() => handleView(item)}
                          style={{ flex: 1 }}
                        >
                          <Eye size="14" />
                          {t('content.view')}
                        </Button>
                        <Button 
                          size="1" 
                          variant="soft" 
                          onClick={() => handleDetails(item)}
                          style={{ flex: 1 }}
                        >
                          <FileText size="14" />
                          {t('content.details')}
                        </Button>
                        <Button 
                          size="1" 
                          variant="soft" 
                          onClick={() => handleDownload(item)}
                          style={{ flex: 1 }}
                        >
                          <Download size="14" />
                          {t('content.download')}
                        </Button>

                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Grid>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Flex justify="center" gap="2" mt="4">
                <Button 
                  variant="soft" 
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t('content.previous')}
                </Button>
                <Text style={{ minWidth: '100px', textAlign: 'center' }}>
                  {t('content.pageInfo', { current: page, total: pagination.totalPages })}
                </Text>
                <Button 
                  variant="soft" 
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('content.next')}
                </Button>
              </Flex>
            )}
          </>
        )}
      </Flex>
    </Box>
  );
} 
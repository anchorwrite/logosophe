'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Text, Card, Grid, Badge, Button, Select, TextField } from '@radix-ui/themes';
import { Search, Download, Eye, TrendingUp, Calendar, User } from 'lucide-react';

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
  ViewCount?: number;
  DownloadCount?: number;
  PublisherName?: string;
}

interface ContentAnalytics {
  totalViews: number;
  totalDownloads: number;
  totalContent: number;
  recentViews: number;
  recentDownloads: number;
}

interface ContentDashboardProps {
  lang: string;
}

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

export function SubscriberContentDashboard({ lang }: ContentDashboardProps) {
  const { t } = useTranslation('translations');
  const [content, setContent] = useState<PublishedContent[]>([]);
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'views' | 'downloads' | 'name'>('newest');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch published content for the current user
        const contentResponse = await fetch('/api/harbor/content');
        if (!contentResponse.ok) {
          throw new Error('Failed to fetch content');
        }
        const contentData = await contentResponse.json() as PublishedContent[];
        setContent(contentData);

        // Fetch analytics
        const analyticsResponse = await fetch('/api/harbor/content/analytics');
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json() as ContentAnalytics;
          setAnalytics(analyticsData);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const filteredContent = content.filter(item => {
    const matchesSearch = item.FileName.toLowerCase().includes(search.toLowerCase());
    const matchesType = type === 'all' || item.MediaType === type;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.PublishedAt).getTime() - new Date(a.PublishedAt).getTime();
      case 'oldest':
        return new Date(a.PublishedAt).getTime() - new Date(b.PublishedAt).getTime();
      case 'views':
        return (b.ViewCount || 0) - (a.ViewCount || 0);
      case 'downloads':
        return (b.DownloadCount || 0) - (a.DownloadCount || 0);
      case 'name':
        return a.FileName.localeCompare(b.FileName);
      default:
        return 0;
    }
  });

  const handleView = (content: PublishedContent) => {
    if (content.AccessToken) {
      window.open(`/api/content/${content.AccessToken}/preview?noLog=true`, '_blank');
    }
  };

  const handleDownload = (content: PublishedContent) => {
    if (content.AccessToken) {
      const downloadUrl = `/api/content/${content.AccessToken}/download?noLog=true`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = content.FileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDetails = (content: PublishedContent) => {
    if (content.AccessToken) {
      window.open(`/${lang}/content/${content.AccessToken}/view`, '_blank');
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

  if (isLoading) {
    return (
      <Box p="4">
        <Text>{t('content.loading')}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="4">
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box p="4">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box style={{ textAlign: 'center' }} mb="6">
          <Text size="6" weight="bold" mb="3" style={{ display: 'block' }}>
            {t('content.subscriberDashboard')}
          </Text>
          <Text color="gray" size="3" style={{ display: 'block' }}>
            {t('content.dashboardDescription')}
          </Text>
        </Box>

        {/* Analytics Cards */}
        {analytics && (
          <Grid columns={{ initial: "1", sm: "2", md: "4" }} gap="4">
            <Card>
              <Box p="4">
                <Flex align="center" gap="2">
                  <Eye size="20" />
                  <Box>
                    <Text size="2" color="gray">{t('content.totalViews')}:</Text>
                    <Text size="4" weight="bold">{analytics.totalViews}</Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
            <Card>
              <Box p="4">
                <Flex align="center" gap="2">
                  <Download size="20" />
                  <Box>
                    <Text size="2" color="gray">{t('content.totalDownloads')}:</Text>
                    <Text size="4" weight="bold">{analytics.totalDownloads}</Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
            <Card>
              <Box p="4">
                <Flex align="center" gap="2">
                <TrendingUp size="20" />
                  <Box>
                    <Text size="2" color="gray">{t('content.totalContent')}:</Text>
                    <Text size="4" weight="bold">{analytics.totalContent}</Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
            <Card>
              <Box p="4">
                <Flex align="center" gap="2">
                  <Calendar size="20" />
                  <Box>
                    <Text size="2" color="gray">{t('content.recentActivity')}:</Text>
                    <Text size="4" weight="bold">{analytics.recentViews + analytics.recentDownloads}</Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Grid>
        )}

        {/* Filters */}
        <Card>
          <Box p="4">
            <Flex gap="3" wrap="wrap" align="center" justify="center">
              <TextField.Root size="2">
                <TextField.Slot>
                  <Search size="16" />
                </TextField.Slot>
                <TextField.Input 
                  placeholder={t('content.searchContent')}
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

              <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <Select.Trigger placeholder={t('content.sortBy')} />
                <Select.Content>
                  <Select.Item value="newest">{t('content.newest')}</Select.Item>
                  <Select.Item value="oldest">{t('content.oldest')}</Select.Item>
                  <Select.Item value="views">{t('content.mostViewed')}</Select.Item>
                  <Select.Item value="downloads">{t('content.mostDownloaded')}</Select.Item>
                  <Select.Item value="name">{t('content.name')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>
          </Box>
        </Card>

        {/* Content Grid */}
        {filteredContent.length === 0 ? (
          <Flex justify="center" p="4">
            <Text color="gray">{t('content.noPublishedContent')}</Text>
          </Flex>
        ) : (
          <Grid columns={{ initial: "1", sm: "2", md: "3", lg: "4" }} gap="4">
            {filteredContent.map((item) => (
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

                    {/* Analytics */}
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        {formatBytes(item.FileSize)} • {formatDate(item.PublishedAt)}
                      </Text>
                      <Flex gap="2" align="center">
                        <Text size="1" color="gray">
                          <Eye size="12" /> {item.ViewCount || 0}
                        </Text>
                        <Text size="1" color="gray">
                          <Download size="12" /> {item.DownloadCount || 0}
                        </Text>
                                             </Flex>
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
                        <User size="14" />
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
        )}
      </Flex>
    </Box>
  );
} 
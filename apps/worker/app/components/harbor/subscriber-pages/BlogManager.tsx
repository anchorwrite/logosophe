'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Box, Flex, Heading, Text, Card, TextField, Badge, Separator, Select } from '@radix-ui/themes';
import Container from '@/common/Container';
import TextArea from '@/common/TextArea';

interface SubscriberBlogPost {
  Id: number;
  HandleId: number;
  Title: string;
  Content: string;
  Excerpt?: string;
  Status: 'draft' | 'published' | 'archived';
  PublishedAt?: string;
  Language: string;
  Tags?: string;
  ViewCount: number;
  CreatedAt: string;
  UpdatedAt: string;
  Handle?: string;
  HandleDisplayName?: string;
}

interface SubscriberHandle {
  Id: number;
  Handle: string;
  DisplayName: string;
  IsActive: boolean;
  IsPublic: boolean;
}

interface CreateBlogPostRequest {
  handleId: number;
  title: string;
  content: string;
  excerpt?: string;
  language: string;
  tags?: string;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function BlogManager({ subscriberEmail }: { subscriberEmail: string }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<SubscriberBlogPost[]>([]);
  const [handles, setHandles] = useState<SubscriberHandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateBlogPostRequest>({
    handleId: 0,
    title: '',
    content: '',
    excerpt: '',
    language: 'en',
    tags: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    language: 'all',
    handleId: 'all',
    search: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Fetch posts and handles
  useEffect(() => {
    fetchHandles();
    fetchPosts();
  }, [subscriberEmail, filters, pagination.page]);

  const fetchHandles = async () => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch handles');
      }
      
      const data = await response.json() as ApiResponse<SubscriberHandle[]>;
      
      // Ensure handles is always an array
      if (data.data && Array.isArray(data.data)) {
        setHandles(data.data);
        
        // Set first handle as default if available
        if (data.data.length > 0 && formData.handleId === 0) {
          setFormData(prev => ({ ...prev, handleId: data.data[0].Id }));
        }
      } else {
        setHandles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch handles');
      setHandles([]); // Ensure handles is an array even on error
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.language !== 'all' && { language: filters.language }),
        ...(filters.handleId !== 'all' && { handleId: filters.handleId }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/blog?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch blog posts');
      }
      
      const data = await response.json() as PaginatedResponse<SubscriberBlogPost>;
      
      // Ensure posts is always an array
      if (data.data && Array.isArray(data.data)) {
        setPosts(data.data);
      } else {
        setPosts([]);
      }
      
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch blog posts');
      setPosts([]); // Ensure posts is an array even on error
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateBlogPostRequest, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createPost = async () => {
    if (!formData.title.trim() || !formData.content.trim() || !formData.handleId) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/blog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to create blog post');
      }

      const data = await response.json() as ApiResponse<SubscriberBlogPost>;
      setPosts(prev => [data.data, ...prev]);
      setShowCreateForm(false);
      setFormData({
        handleId: formData.handleId, // Keep the same handle
        title: '',
        content: '',
        excerpt: '',
        language: 'en',
        tags: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blog post');
    } finally {
      setCreating(false);
    }
  };

  const updatePostStatus = async (postId: number, status: 'draft' | 'published' | 'archived') => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/blog/${postId}`, {
        method: status === 'archived' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: status === 'published' ? JSON.stringify({ publishedAt: new Date().toISOString() }) : undefined
      });

      if (!response.ok) {
        throw new Error('Failed to update post status');
      }

      setPosts(prev => prev.map(post => 
        post.Id === postId ? { ...post, Status: status } : post
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post status');
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'green';
      case 'draft': return 'yellow';
      case 'archived': return 'gray';
      default: return 'gray';
    }
  };

  if (loading && posts.length === 0) {
    return (
      <Card>
        <Box p="6">
          <Flex justify="center" align="center">
            <Text size="5">{t('common.loading')}</Text>
          </Flex>
        </Box>
      </Card>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Overview Section */}
      <Card>
        <Box p="6">
          <Flex justify="between" align="center" mb="4">
            <Box>
              <Heading size="6" mb="2">
                {t('subscriber_pages.blog.title')}
              </Heading>
              <Text color="gray">
                {t('subscriber_pages.blog.description')}
              </Text>
            </Box>
            <Button
              onClick={() => setShowCreateForm(true)}
              disabled={showCreateForm || handles.length === 0}
              variant="solid"
              size="3"
            >
              {t('subscriber_pages.blog.create_new')}
            </Button>
          </Flex>

          {/* Error Display */}
          {error && (
            <Card style={{ backgroundColor: 'var(--red-2)', border: '1px solid var(--red-6)' }} mb="4">
              <Box p="4">
                <Text color="red">{error}</Text>
              </Box>
            </Card>
          )}

          {/* Stats */}
          <Flex gap="4">
            <Card style={{ backgroundColor: 'var(--blue-2)', border: '1px solid var(--blue-6)' }}>
              <Box p="3">
                <Text size="2" weight="medium" color="blue">
                  {t('subscriber_pages.blog.total_posts')}: {pagination.total}
                </Text>
              </Box>
            </Card>
            <Card style={{ backgroundColor: 'var(--green-2)', border: '1px solid var(--green-6)' }}>
              <Box p="3">
                <Text size="2" weight="medium" color="green">
                  {t('subscriber_pages.blog.published')}: {posts.filter(p => p.Status === 'published').length}
                </Text>
              </Box>
            </Card>
            <Card style={{ backgroundColor: 'var(--yellow-2)', border: '1px solid var(--yellow-6)' }}>
              <Box p="3">
                <Text size="2" weight="medium" color="yellow">
                  {t('subscriber_pages.blog.drafts')}: {posts.filter(p => p.Status === 'draft').length}
                </Text>
              </Box>
            </Card>
          </Flex>
        </Box>
      </Card>

      {/* Filters Section */}
      <Card>
        <Box p="6">
          <Heading size="5" mb="4">
            {t('subscriber_pages.blog.filters.title')}
          </Heading>
          
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.blog.filters.status')}
              </Text>
              <Select.Root value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  <Select.Item value="draft">{t('common.draft')}</Select.Item>
                  <Select.Item value="published">{t('common.published')}</Select.Item>
                  <Select.Item value="archived">{t('common.archived')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.blog.filters.language')}
              </Text>
              <Select.Root value={filters.language} onValueChange={(value) => handleFilterChange('language', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  <Select.Item value="en">English</Select.Item>
                  <Select.Item value="es">Español</Select.Item>
                  <Select.Item value="fr">Français</Select.Item>
                  <Select.Item value="de">Deutsch</Select.Item>
                  <Select.Item value="nl">Nederlands</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.blog.filters.handle')}
              </Text>
              <Select.Root value={filters.handleId} onValueChange={(value) => handleFilterChange('handleId', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  {handles.map(handle => (
                    <Select.Item key={handle.Id} value={handle.Id.toString()}>
                      {handle.DisplayName}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.blog.filters.search')}
              </Text>
              <TextField.Root>
                <TextField.Input
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder={t('subscriber_pages.blog.filters.search_placeholder')}
                />
              </TextField.Root>
            </Box>
          </Box>
        </Box>
      </Card>

      {/* Create Blog Post Form Section */}
      {showCreateForm && (
        <Card style={{ backgroundColor: 'var(--gray-2)', border: '2px solid var(--blue-6)' }}>
          <Box p="6">
            <Heading size="5" mb="4" color="blue">
              {t('subscriber_pages.blog.create_form.title')}
            </Heading>
            
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Handle Selection */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.blog.create_form.handle')}
                </Text>
                <Select.Root value={formData.handleId.toString()} onValueChange={(value) => handleInputChange('handleId', parseInt(value))}>
                  <Select.Trigger />
                  <Select.Content>
                    {handles.map(handle => (
                      <Select.Item key={handle.Id} value={handle.Id.toString()}>
                        {handle.DisplayName} ({handle.Handle})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              {/* Title Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.blog.create_form.title')}
                </Text>
                <TextField.Root>
                  <TextField.Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder={t('subscriber_pages.blog.create_form.title_placeholder')}
                    size="3"
                  />
                </TextField.Root>
              </Box>

              {/* Content Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.blog.create_form.content')}
                </Text>
                <TextArea
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder={t('subscriber_pages.blog.create_form.content_placeholder')}
                  name="content"
                />
              </Box>

              {/* Excerpt Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.blog.create_form.excerpt')}
                </Text>
                <TextArea
                  value={formData.excerpt}
                  onChange={(e) => handleInputChange('excerpt', e.target.value)}
                  placeholder={t('subscriber_pages.blog.create_form.excerpt_placeholder')}
                  name="excerpt"
                />
              </Box>

              {/* Language and Tags */}
              <Flex gap="4">
                <Box style={{ flex: 1 }}>
                  <Text weight="medium" size="3" mb="2">
                    {t('subscriber_pages.blog.create_form.language')}
                  </Text>
                  <Select.Root value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="en">English</Select.Item>
                      <Select.Item value="es">Español</Select.Item>
                      <Select.Item value="fr">Français</Select.Item>
                      <Select.Item value="de">Deutsch</Select.Item>
                      <Select.Item value="nl">Nederlands</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box style={{ flex: 1 }}>
                  <Text weight="medium" size="3" mb="2">
                    {t('subscriber_pages.blog.create_form.tags')}
                  </Text>
                  <TextField.Root>
                    <TextField.Input
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      placeholder={t('subscriber_pages.blog.create_form.tags_placeholder')}
                      size="3"
                    />
                  </TextField.Root>
                </Box>
              </Flex>

              <Separator />

              {/* Form Actions */}
              <Flex justify="end" gap="3">
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      handleId: formData.handleId,
                      title: '',
                      content: '',
                      excerpt: '',
                      language: 'en',
                      tags: ''
                    });
                  }}
                  variant="soft"
                  size="3"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={createPost}
                  disabled={creating}
                  variant="solid"
                  size="3"
                >
                  {creating ? t('common.creating') : t('common.create')}
                </Button>
              </Flex>
            </Box>
          </Box>
        </Card>
      )}

      {/* Blog Posts List Section */}
      <Card>
        <Box p="6">
          <Heading size="5" mb="4">
            {t('subscriber_pages.blog.your_posts')} ({pagination.total})
          </Heading>

          <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!Array.isArray(posts) ? (
              <Box py="6">
                <Flex justify="center" align="center">
                  <Text color="red" size="5">{t('common.loading')}</Text>
                </Flex>
              </Box>
            ) : posts.length === 0 ? (
              <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                <Box p="6">
                  <Flex justify="center" align="center">
                    <Text color="gray" size="5">{t('subscriber_pages.blog.no_posts')}</Text>
                  </Flex>
                </Box>
              </Card>
            ) : (
              posts.map((post) => (
                <Card key={post.Id} style={{ border: '1px solid var(--gray-6)' }}>
                  <Box p="5">
                    <Flex justify="between" align="start">
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" gap="3" mb="3">
                          <Heading size="4">{post.Title}</Heading>
                          <Badge color={getStatusColor(post.Status)} size="2">
                            {t(`common.${post.Status}`)}
                          </Badge>
                          {post.HandleDisplayName && (
                            <Badge color="blue" size="2">
                              {post.HandleDisplayName}
                            </Badge>
                          )}
                        </Flex>
                        
                        {post.Excerpt && (
                          <Text color="gray" mb="3" size="3">{post.Excerpt}</Text>
                        )}
                        
                        <Flex gap="4" align="center" mb="3">
                          <Text size="2" color="gray">
                            {t('subscriber_pages.blog.views')}: {post.ViewCount}
                          </Text>
                          <Text size="2" color="gray">
                            {t('subscriber_pages.blog.published_on')}: {new Date(post.CreatedAt).toLocaleDateString()}
                          </Text>
                          {post.Language && (
                            <Badge color="gray" size="1">
                              {post.Language.toUpperCase()}
                            </Badge>
                          )}
                        </Flex>
                        
                        {post.Tags && (
                          <Text size="2" color="gray">
                            {t('subscriber_pages.blog.tags')}: {post.Tags}
                          </Text>
                        )}
                      </Box>
                      
                      <Flex gap="2">
                        {post.Status === 'draft' && (
                          <Button
                            onClick={() => updatePostStatus(post.Id, 'published')}
                            variant="solid"
                            size="2"
                          >
                            {t('common.publish')}
                          </Button>
                        )}
                        {post.Status === 'published' && (
                          <Button
                            onClick={() => updatePostStatus(post.Id, 'archived')}
                            variant="soft"
                            size="2"
                          >
                            {t('common.archive')}
                          </Button>
                        )}
                        {post.Status === 'archived' && (
                          <Button
                            onClick={() => updatePostStatus(post.Id, 'published')}
                            variant="solid"
                            size="2"
                          >
                            {t('common.restore')}
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))
            )}
          </Box>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Flex justify="center" gap="2" mt="4">
              <Button
                variant="soft"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                {t('common.previous')}
              </Button>
              <Text align="center" style={{ minWidth: '100px', lineHeight: '32px' }}>
                {t('common.page_info', { current: pagination.page, total: pagination.totalPages })}
              </Text>
              <Button
                variant="soft"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
              >
                {t('common.next')}
              </Button>
            </Flex>
          )}
        </Box>
      </Card>
    </Box>
  );
}

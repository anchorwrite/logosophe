'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Badge, Button } from '@radix-ui/themes';

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
  Description?: string;
  IsActive: boolean;
  IsPublic: boolean;
  CreatedAt: string;
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

export default function PublicHandlePage() {
  const { t } = useTranslation();
  const params = useParams();
  const handle = params.handle as string;
  
  const [handleInfo, setHandleInfo] = useState<SubscriberHandle | null>(null);
  const [posts, setPosts] = useState<SubscriberBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (handle) {
      fetchHandleInfo();
      fetchPosts();
    }
  }, [handle, currentPage]);

  const fetchHandleInfo = async () => {
    try {
      const response = await fetch(`/api/harbor/handles/${encodeURIComponent(handle)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Page not found');
        } else {
          throw new Error('Failed to fetch handle information');
        }
        return;
      }
      
      const data = await response.json() as ApiResponse<SubscriberHandle>;
      setHandleInfo(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch handle information');
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: 'published'
      });

      const response = await fetch(`/api/harbor/handles/${encodeURIComponent(handle)}/blog?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch blog posts');
      }
      
      const data = await response.json() as PaginatedResponse<SubscriberBlogPost>;
      
      if (data.data && Array.isArray(data.data)) {
        setPosts(data.data);
        setTotalPages(data.pagination?.totalPages || 0);
      } else {
        setPosts([]);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch blog posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card>
          <Box p="6">
            <Heading size="6" color="red" mb="2">
              {error === 'Page not found' ? '404 - Page Not Found' : 'Error'}
            </Heading>
            <Text color="gray">
              {error === 'Page not found' 
                ? 'The page you are looking for does not exist or is not public.'
                : error
              }
            </Text>
          </Box>
        </Card>
      </Box>
    );
  }

  if (loading && !handleInfo) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="5">{t('common.loading')}</Text>
      </Box>
    );
  }

  if (!handleInfo) {
    return null;
  }

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      {/* Header */}
      <Box style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-6)' }}>
        <Box style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
          <Heading size="8" mb="2">
            {handleInfo.DisplayName}
          </Heading>
          {handleInfo.Description && (
            <Text color="gray" size="5" mb="2">
              {handleInfo.Description}
            </Text>
          )}
          <Text size="2" color="gray">
            logosophe.com/{handleInfo.Handle}
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Blog Posts */}
        <Box mb="6">
          <Heading size="6" mb="4">
            Blog Posts
          </Heading>
          
          {loading ? (
            <Box py="6">
              <Flex justify="center" align="center">
                <Text size="5">{t('common.loading')}</Text>
              </Flex>
            </Box>
          ) : posts.length === 0 ? (
            <Card>
              <Box p="6">
                <Text color="gray" align="center">
                  No blog posts published yet.
                </Text>
              </Box>
            </Card>
          ) : (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {posts.map((post) => (
                <Card key={post.Id}>
                  <Box p="4">
                    <Heading size="4" mb="2">
                      {post.Title}
                    </Heading>
                    {post.Excerpt && (
                      <Text color="gray" mb="2">
                        {post.Excerpt}
                      </Text>
                    )}
                    <Flex justify="between" align="center" mt="3">
                      <Flex gap="2" align="center">
                        <Text size="2" color="gray">
                          {new Date(post.CreatedAt).toLocaleDateString()}
                        </Text>
                        {post.ViewCount > 0 && (
                          <Text size="2" color="gray">
                            {post.ViewCount} {t('subscriber_pages.blog.views')}
                          </Text>
                        )}
                        {post.Language && (
                          <Badge color="blue">
                            {post.Language.toUpperCase()}
                          </Badge>
                        )}
                      </Flex>
                      <Button variant="outline" size="2">
                        Read More
                      </Button>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Flex justify="center" gap="2" mt="4">
              <Button
                variant="soft"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                {t('common.previous')}
              </Button>
              <Text align="center" style={{ minWidth: '100px', lineHeight: '32px' }}>
                {t('common.page_info', { current: currentPage, total: totalPages })}
              </Text>
              <Button
                variant="soft"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                {t('common.next')}
              </Button>
            </Flex>
          )}
        </Box>
      </Box>
    </Box>
  );
}

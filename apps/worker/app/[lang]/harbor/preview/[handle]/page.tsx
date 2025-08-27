'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Container, Separator, Button, Badge } from '@radix-ui/themes';
import { SubscriberHandle, SubscriberBlogPost } from '@/types/subscriber-pages';
import { useSession } from 'next-auth/react';

interface PreviewHandlePageProps {
  params: Promise<{ lang: string; handle: string }>;
}

export default function PreviewHandlePage({ params }: PreviewHandlePageProps) {
  const { t } = useTranslation('translations');
  const { data: session } = useSession();
  const [handle, setHandle] = useState<SubscriberHandle | null>(null);
  const [blogPosts, setBlogPosts] = useState<SubscriberBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lang, setLang] = useState<string>('en');
  const [viewedPosts, setViewedPosts] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const { lang: langParam, handle: handleName } = await params;
        setLang(langParam);
        
        // Load handle information (internal API that doesn't require public status)
        const handleResponse = await fetch(`/api/harbor/preview/${handleName}`);
        if (!handleResponse.ok) {
          throw new Error('Handle not found');
        }
        const handleData = await handleResponse.json() as { success: boolean; data: SubscriberHandle };
        setHandle(handleData.data);

        // Load blog posts (internal API)
        const blogResponse = await fetch(`/api/harbor/preview/${handleName}/blog?page=${currentPage}&limit=10&status=published`);
        if (blogResponse.ok) {
          const blogData = await blogResponse.json() as { 
            success: boolean; 
            data: SubscriberBlogPost[]; 
            pagination: { totalPages: number } 
          };
          setBlogPosts(blogData.data);
          setTotalPages(blogData.pagination.totalPages);
        }

      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'Handle not found') {
            setError('not_found');
          } else if (err.message.includes('Failed to fetch')) {
            setError('network_error');
          } else {
            setError('general_error');
          }
        } else {
          setError('general_error');
        }
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [params, currentPage]);

  // Track views for blog posts when they're displayed
  useEffect(() => {
    if (blogPosts.length > 0 && handle) {
      blogPosts.forEach(post => {
        if (!viewedPosts.has(post.Id)) {
          trackBlogPostView(post.Id, handle.Handle);
          setViewedPosts(prev => new Set(prev).add(post.Id));
        }
      });
    }
  }, [blogPosts, handle, viewedPosts]);

  const trackBlogPostView = async (postId: number, handleName: string) => {
    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${postId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: { viewCount: number } };
        if (data.success) {
          // Update the view count in the local state
          setBlogPosts(prev => prev.map(post => 
            post.Id === postId 
              ? { ...post, ViewCount: data.data.viewCount }
              : post
          ));
        }
      }
    } catch (error) {
      // Silently fail view tracking - don't break the user experience
      console.error('Failed to track blog post view:', error);
    }
  };

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
        <Container size="4" py="6">
          <Flex justify="center" align="center" style={{ minHeight: '50vh' }}>
            <Text size="5">{t('common.loading')}</Text>
          </Flex>
        </Container>
      </Box>
    );
  }

  if (error || !handle) {
    return (
      <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
        <Container size="4" py="6">
          <Flex direction="column" justify="center" align="center" style={{ minHeight: '50vh' }} gap="6">
            {/* Error Icon */}
            <Box style={{ fontSize: '4rem', color: 'var(--gray-8)' }}>📄</Box>
            
            {/* Main Error Message */}
            <Box style={{ textAlign: 'center' }}>
              <Heading size="8" mb="3" color="gray">
                {error === 'not_found' 
                  ? t('subscriber_pages.preview_page.page_not_found')
                  : t('subscriber_pages.preview_page.page_unavailable')
                }
              </Heading>
              <Text size="5" color="gray" mb="4">
                {error === 'not_found'
                  ? t('subscriber_pages.preview_page.page_not_found_description')
                  : error === 'network_error'
                  ? t('subscriber_pages.preview_page.network_error_description')
                  : t('subscriber_pages.preview_page.page_unavailable_description')
                }
              </Text>
            </Box>
            
            {/* Action Buttons */}
            <Flex gap="4" wrap="wrap" justify="center">
              <Button 
                size="4" 
                variant="solid"
                onClick={() => window.location.href = `/${lang}/harbor/subscriber-pages`}
              >
                {t('subscriber_pages.preview_page.back_to_handles')}
              </Button>
              <Button 
                size="4" 
                variant="outline"
                onClick={() => window.history.back()}
              >
                {t('subscriber_pages.preview_page.go_back')}
              </Button>
            </Flex>
            
            {/* Additional Help */}
            <Box style={{ textAlign: 'center' }} mt="4">
              <Text size="3" color="gray">
                {t('subscriber_pages.preview_page.help_text')}
              </Text>
            </Box>
          </Flex>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      {/* Preview Header */}
      <Box style={{ backgroundColor: 'var(--orange-2)', borderBottom: '1px solid var(--orange-6)' }}>
        <Container size="4">
          <Box py="4">
            <Flex justify="center" align="center" gap="3">
              <Badge color="orange" size="2">
                🔒 {t('subscriber_pages.preview_page.preview_mode')}
              </Badge>
              <Text size="3" color="orange">
                {t('subscriber_pages.preview_page.preview_description')}
              </Text>
            </Flex>
          </Box>
        </Container>
      </Box>

      {/* Header */}
      <Box style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-6)' }}>
        <Container size="4">
          <Box py="6">
            <Flex justify="between" align="center">
              <Box>
                <Heading size="8" mb="2">
                  {handle.DisplayName}
                </Heading>
                {handle.Description ? (
                  <Text size="5" color="gray" mb="3">
                    {handle.Description}
                  </Text>
                ) : null}
                <Text size="2" color="gray">
                  {t('common.created')}: {new Date(handle.CreatedAt).toLocaleDateString()}
                </Text>
              </Box>
              <Text size="2" color="gray">
                {t('common.created')}: {new Date(handle.CreatedAt).toLocaleDateString()}
              </Text>
            </Flex>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container size="4" py="6">
        {/* Bio Section */}
        <Card mb="6">
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.bio')}
            </Heading>
            <Text size="3" color="gray">
              {t('subscriber_pages.content.noContent')}
            </Text>
          </Box>
        </Card>

        {/* Blog Posts Section */}
        <Card mb="6">
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.blog')}
            </Heading>
            
            {blogPosts.length > 0 ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {blogPosts.map((post) => (
                  <Card key={post.Id} style={{ backgroundColor: 'var(--gray-2)' }}>
                    <Box p="4">
                      <Heading size="4" mb="2">
                        {post.Title}
                      </Heading>
                      {post.Excerpt ? (
                        <Text size="3" color="gray" mb="2">
                          {post.Excerpt}
                        </Text>
                      ) : null}
                      <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                          {new Date(post.CreatedAt).toLocaleDateString()}
                        </Text>
                        <Text size="2" color="gray">
                          {post.ViewCount} {t('subscriber_pages.blog.views')}
                        </Text>
                      </Flex>
                    </Box>
                  </Card>
                ))}
              </Box>
            ) : (
              <Text size="3" color="gray">
                {t('subscriber_pages.content.noContent')}
              </Text>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" align="center" mt="4" gap="2">
                <Button
                  variant="soft"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  {t('common.previous')}
                </Button>
                
                <Text size="2" color="gray">
                  {t('common.page_info', { current: currentPage, total: totalPages })}
                </Text>
                
                <Button
                  variant="soft"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  {t('common.next')}
                </Button>
              </Flex>
            )}
          </Box>
        </Card>

        {/* Contact Section */}
        <Card>
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.contact')}
            </Heading>
            <Text size="3" color="gray">
              {t('subscriber_pages.content.noContent')}
            </Text>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}

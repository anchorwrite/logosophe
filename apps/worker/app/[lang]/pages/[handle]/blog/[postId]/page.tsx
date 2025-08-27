'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Flex, Heading, Text, Card, Container, Separator, Button, Badge } from '@radix-ui/themes';
import { SubscriberBlogPost } from '@/types/subscriber-pages';
import SubscriberPagesAppBar from '@/components/SubscriberPagesAppBar';
import Footer from '@/components/Footer';
import BlogComments from '@/components/harbor/subscriber-pages/BlogComments';
import BlogRatings from '@/components/harbor/subscriber-pages/BlogRatings';

interface BlogPostDetailPageProps {
  params: Promise<{ lang: string; handle: string; postId: string }>;
}

export default function BlogPostDetailPage({ params }: BlogPostDetailPageProps) {
  const { t } = useTranslation('translations');
  const { data: session } = useSession();
  
  const [lang, setLang] = useState<string>('en');
  const [handle, setHandle] = useState<string>('');
  const [post, setPost] = useState<SubscriberBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBlogPost = async () => {
      try {
        const { lang: langParam, handle: handleName, postId } = await params;
        setLang(langParam);
        setHandle(handleName);
        
        // Load blog post details
        const postResponse = await fetch(`/api/pages/${handleName}/blog/${postId}`);
        if (!postResponse.ok) {
          throw new Error('Blog post not found');
        }
        
        const postData = await postResponse.json() as { success: boolean; data: SubscriberBlogPost };
        if (postData.success) {
          setPost(postData.data);
        } else {
          throw new Error('Failed to load blog post');
        }

      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'Blog post not found') {
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

    loadBlogPost();
  }, [params]);

  const handleCommentAdded = () => {
    // Refresh the post data if needed
    // For now, just log the event
    console.log('Comment added to blog post');
  };

  const handleRatingAdded = () => {
    // Refresh the post data if needed
    // For now, just log the event
    console.log('Rating added to blog post');
  };

  if (loading) {
    return (
      <Box>
        <SubscriberPagesAppBar lang={lang as 'en' | 'es' | 'fr' | 'de' | 'nl'} />
        <Container size="4" py="6">
          <Text>{t('common.loading')}</Text>
        </Container>
        <Footer />
      </Box>
    );
  }

  if (error || !post) {
    return (
      <Box>
        <SubscriberPagesAppBar lang={lang as 'en' | 'es' | 'fr' | 'de' | 'nl'} />
        <Container size="4" py="6">
          <Card>
            <Box p="6" style={{ textAlign: 'center' }}>
              <Heading size="6" mb="4">
                {error === 'not_found' 
                  ? t('subscriber_pages.public_page.page_not_found')
                  : t('subscriber_pages.public_page.network_error')
                }
              </Heading>
              <Text size="3" color="gray" mb="4">
                {error === 'not_found'
                  ? t('subscriber_pages.public_page.page_not_found_description')
                  : t('subscriber_pages.public_page.network_error_description')
                }
              </Text>
              <Button asChild>
                <a href={`/${lang}/pages/${handle}`}>
                  {t('subscriber_pages.public_page.go_back')}
                </a>
              </Button>
            </Box>
          </Card>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box>
      <SubscriberPagesAppBar lang={lang as 'en' | 'es' | 'fr' | 'de' | 'nl'} />
      
      <Container size="4" py="6">
        {/* Blog Post Content */}
        <Card mb="6">
          <Box p="6">
            <Heading size="6" mb="4">
              {post.Title}
            </Heading>
            
            {post.Excerpt && (
              <Text size="4" color="gray" mb="4" style={{ fontStyle: 'italic' }}>
                {post.Excerpt}
              </Text>
            )}
            
            <Flex gap="2" align="center" mb="4">
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
              {post.Tags && (
                <Badge color="green">
                  {post.Tags}
                </Badge>
              )}
            </Flex>
            
            <Separator mb="4" />
            
            <Box 
              style={{ 
                lineHeight: '1.6',
                fontSize: 'var(--font-size-3)'
              }}
              dangerouslySetInnerHTML={{ __html: post.Content }}
            />

            {/* Linked Harbor Content */}
            {post.linkedContent && post.linkedContent.length > 0 && (
              <Box mt="6">
                <Separator mb="4" />
                <Heading size="4" mb="4">
                  {t('subscriber_pages.blog.linked_content_title')}
                </Heading>
                <Flex direction="column" gap="3">
                  {post.linkedContent.map((content) => (
                    <Card key={content.id}>
                      <Box p="4">
                        <Flex justify="between" align="start" gap="3">
                          <Box style={{ flex: 1 }}>
                            <Heading size="3" mb="2">
                              {content.title}
                            </Heading>
                            {content.description && (
                              <Text size="2" color="gray" mb="2">
                                {content.description}
                              </Text>
                            )}
                            <Flex gap="2" align="center" mb="2">
                              {content.form && (
                                <Badge color="blue">
                                  {content.form}
                                </Badge>
                              )}
                              {content.genre && (
                                <Badge color="green">
                                  {content.genre}
                                </Badge>
                              )}
                              {content.language && (
                                <Badge color="orange">
                                  {content.language.toUpperCase()}
                                </Badge>
                              )}
                            </Flex>
                            <Text size="1" color="gray">
                              {t('subscriber_pages.blog.published_by')}: {content.publisher.name}
                            </Text>
                          </Box>
                          <Button asChild size="2">
                            <a 
                              href={`/api/harbor/content/${content.id}/download?token=${content.accessToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t('common.download')}
                            </a>
                          </Button>
                        </Flex>
                      </Box>
                    </Card>
                  ))}
                </Flex>
              </Box>
            )}
          </Box>
        </Card>

        {/* Ratings Section */}
        <Card mb="6">
          <Box p="6">
            <BlogRatings 
              blogPostId={post.Id} 
              handleName={handle}
              onRatingAdded={handleRatingAdded}
            />
          </Box>
        </Card>

        {/* Comments Section */}
        <Card mb="6">
          <Box p="6">
            <BlogComments 
              blogPostId={post.Id} 
              handleName={handle}
              onCommentAdded={handleCommentAdded}
            />
          </Box>
        </Card>

        {/* Back to Handle Page */}
        <Box style={{ textAlign: 'center' }}>
          <Button asChild variant="soft">
            <a href={`/${lang}/pages/${handle}`}>
              ← {t('subscriber_pages.public_page.go_back')}
            </a>
          </Button>
        </Box>
      </Container>
      
      <Footer />
    </Box>
  );
}

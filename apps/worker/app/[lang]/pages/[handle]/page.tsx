'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Flex, Heading, Text, Card, Container, Separator, Button, Badge } from '@radix-ui/themes';
import { SubscriberHandle, SubscriberBlogPost, SubscriberAnnouncement, SubscriberBiography, SubscriberContactInfo } from '@/types/subscriber-pages';
import SubscriberPagesAppBar from '@/components/SubscriberPagesAppBar';
import Footer from '@/components/Footer';
import BlogComments from '@/components/harbor/subscriber-pages/BlogComments';
import SubscriberOptIn from '@/components/SubscriberOptIn';

interface PublicHandlePageProps {
  params: Promise<{ lang: string; handle: string }>;
}

export default function PublicHandlePage({ params }: PublicHandlePageProps) {
  const { t } = useTranslation('translations');
  const [handle, setHandle] = useState<SubscriberHandle | null>(null);
  const [blogPosts, setBlogPosts] = useState<SubscriberBlogPost[]>([]);
  const [announcements, setAnnouncements] = useState<SubscriberAnnouncement[]>([]);
  const [biography, setBiography] = useState<SubscriberBiography | null>(null);
  const [contactInfo, setContactInfo] = useState<SubscriberContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lang, setLang] = useState<string>('en');
  const [viewedPosts, setViewedPosts] = useState<Set<number>>(new Set());
  const [showOptIn, setShowOptIn] = useState(false);
  const [subscriberStatusChecked, setSubscriberStatusChecked] = useState(false);
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);
  const { data: session } = useSession();

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const { lang: langParam, handle: handleName } = await params;
        setLang(langParam);
        
        // Load handle information
        const handleResponse = await fetch(`/api/pages/${handleName}`);
        if (!handleResponse.ok) {
          throw new Error('Handle not found');
        }
        const handleData = await handleResponse.json() as { success: boolean; data: SubscriberHandle };
        setHandle(handleData.data);

        // Load announcements
        const announcementsResponse = await fetch(`/api/pages/${handleName}/announcements`);
        if (announcementsResponse.ok) {
          const announcementsData = await announcementsResponse.json() as { 
            success: boolean; 
            data: SubscriberAnnouncement[] 
          };
          if (announcementsData.success) {
            setAnnouncements(announcementsData.data);
          }
        }

        // Load biography
        const biographyResponse = await fetch(`/api/pages/${handleName}/biography`);
        if (biographyResponse.ok) {
          const biographyData = await biographyResponse.json() as { 
            success: boolean; 
            data: SubscriberBiography | null 
          };
          if (biographyData.success) {
            setBiography(biographyData.data);
          }
        }

        // Load contact info
        const contactResponse = await fetch(`/api/pages/${handleName}/contact`);
        if (contactResponse.ok) {
          const contactData = await contactResponse.json() as { 
            success: boolean; 
            data: SubscriberContactInfo | null 
          };
          if (contactData.success) {
            setContactInfo(contactData.data);
          }
        }

        // Load blog posts
        const blogResponse = await fetch(`/api/pages/${handleName}/blog?page=${currentPage}&limit=10&status=published`);
        if (blogResponse.ok) {
          const blogData = await blogResponse.json() as { 
            success: boolean; 
            data: SubscriberBlogPost[]; 
            pagination: { totalPages: number } 
          };
          
          // Fetch ratings for each blog post
          const postsWithRatings = await Promise.all(
            blogData.data.map(async (post) => {
              try {
                const ratingsResponse = await fetch(`/api/pages/${handleName}/blog/${post.Id}/ratings`);
                if (ratingsResponse.ok) {
                  const ratingsData = await ratingsResponse.json() as { 
                    success: boolean; 
                    data: { ratings: any[]; analytics: any } 
                  };
                  if (ratingsData.success) {
                    return {
                      ...post,
                      ratingAnalytics: {
                        averageRating: ratingsData.data.analytics.averageRating,
                        totalRatings: ratingsData.data.analytics.totalRatings,
                        ratingDistribution: ratingsData.data.analytics.ratingDistribution
                      }
                    };
                  }
                }
              } catch (error) {
                console.error(`Error fetching ratings for post ${post.Id}:`, error);
              }
              return post;
            })
          );
          
          setBlogPosts(postsWithRatings);
          setTotalPages(blogData.pagination.totalPages);
        }

      } catch (err) {
        // Provide more user-friendly error messages
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

  // Check if user needs to see opt-in prompt
  useEffect(() => {
    if (session?.user?.email && !subscriberStatusChecked) {
      // Check if we've already shown the opt-in for this user in this session
      const hasShownOptIn = localStorage.getItem(`optInShown_${session.user.email}`);
      
      if (!hasShownOptIn) {
        // Check if user is already a subscriber
        checkSubscriberStatus(session.user.email);
      } else {
        setSubscriberStatusChecked(true);
      }
    }
  }, [session, subscriberStatusChecked]); // Only check once per session

  const checkSubscriberStatus = async (email: string) => {
    try {
      const response = await fetch(`/api/auth/subscriber-status?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json() as { isSubscriber: boolean };
        // If user is not a subscriber, show opt-in prompt
        if (!data.isSubscriber) {
          setShowOptIn(true);
          // Mark that we've shown the opt-in for this user
          localStorage.setItem(`optInShown_${email}`, 'true');
        }
      }
    } catch (error) {
      console.error('Error checking subscriber status:', error);
    } finally {
      // Mark that we've checked the subscriber status for this user
      setSubscriberStatusChecked(true);
    }
  };

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
                  ? t('subscriber_pages.public_page.page_not_found')
                  : t('subscriber_pages.public_page.page_unavailable')
                }
              </Heading>
              <Text size="5" color="gray" mb="4">
                {error === 'not_found'
                  ? t('subscriber_pages.public_page.page_not_found_description')
                  : error === 'network_error'
                  ? t('subscriber_pages.public_page.network_error_description')
                  : t('subscriber_pages.public_page.page_unavailable_description')
                }
              </Text>
            </Box>
            
            {/* Action Buttons */}
            <Flex gap="4" wrap="wrap" justify="center">
              <Button 
                size="4" 
                variant="solid"
                onClick={() => window.location.href = '/'}
              >
                {t('subscriber_pages.public_page.return_home')}
              </Button>
              <Button 
                size="4" 
                variant="outline"
                onClick={() => window.history.back()}
              >
                {t('subscriber_pages.public_page.go_back')}
              </Button>
            </Flex>
            
            {/* Additional Help */}
            <Box style={{ textAlign: 'center' }} mt="4">
              <Text size="3" color="gray">
                {t('subscriber_pages.public_page.help_text')}
              </Text>
            </Box>
          </Flex>
        </Container>
      </Box>
    );
  }

  return (
    <>
      <SubscriberPagesAppBar lang={lang as 'en' | 'es' | 'de' | 'fr' | 'nl'} />
      <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
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
                    <Text size="5" color="gray">
                      {handle.Description}
                    </Text>
                  ) : null}
                </Box>
                <Text size="2" color="gray">
                  {t('subscriber_pages.handles.created')}: {new Date(handle.CreatedAt).toLocaleDateString()}
                </Text>
              </Flex>
            </Box>
          </Container>
        </Box>

      {/* Content */}
      <Container size="4" py="6">
        {/* Announcements Section */}
        {announcements.length > 0 && (
          <Card mb="6">
            <Box p="6">
              <Heading size="6" mb="4">
                {t('subscriber_pages.sections.announcements')}
              </Heading>
              
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {announcements.map((announcement) => (
                  <Card key={announcement.Id} style={{ backgroundColor: 'var(--gray-2)' }}>
                    <Box p="4">
                      <Heading size="4" mb="2">
                        {announcement.Title}
                      </Heading>
                      <Text size="3" color="gray" mb="3">
                        {announcement.Content}
                      </Text>
                      
                      {announcement.Link && announcement.LinkText && (
                        <Box mb="3">
                          <Button asChild variant="solid" size="2">
                            <a href={announcement.Link} target="_blank" rel="noopener noreferrer">
                              {announcement.LinkText}
                            </a>
                          </Button>
                        </Box>
                      )}
                      
                      <Flex gap="2" align="center">
                        <Text size="2" color="gray">
                          {new Date(announcement.PublishedAt).toLocaleDateString()}
                        </Text>
                        {announcement.Language && (
                          <Badge color="blue">
                            {announcement.Language.toUpperCase()}
                          </Badge>
                        )}
                        {announcement.ExpiresAt && (
                          <Badge color="orange" variant="soft">
                            {t('subscriber_pages.announcements.expires')}: {new Date(announcement.ExpiresAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </Flex>
                    </Box>
                  </Card>
                ))}
              </Box>
            </Box>
          </Card>
        )}

        {/* Blog Posts Section */}
        <Card mb="6">
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.blog')}
            </Heading>
            
            {blogPosts.length > 0 ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {blogPosts.map((post) => (
                  <Box key={post.Id}>
                    <Card style={{ backgroundColor: 'var(--gray-2)' }}>
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
                          <Flex gap="2" align="center">
                            <Text size="2" color="gray">
                              {new Date(post.CreatedAt).toLocaleDateString()}
                            </Text>
                            <Text size="2" color="gray">
                              {post.ViewCount} {t('subscriber_pages.blog.views')}
                            </Text>
                            {post.Language && (
                              <Badge color="blue">
                                {post.Language.toUpperCase()}
                              </Badge>
                            )}
                            {/* Ratings Summary */}
                            {post.ratingAnalytics && post.ratingAnalytics.totalRatings > 0 && (
                              <Flex gap="1" align="center">
                                <Text size="2" color="gray">★</Text>
                                <Text size="2" color="gray">
                                  {post.ratingAnalytics.averageRating.toFixed(1)} ({post.ratingAnalytics.totalRatings})
                                </Text>
                              </Flex>
                            )}
                          </Flex>
                          <Button asChild variant="outline" size="2">
                            <a href={`/${lang}/pages/${handle.Handle}/blog/${post.Id}`}>
                              {t('subscriber_pages.blog.read_more')}
                            </a>
                          </Button>
                        </Flex>
                      </Box>
                    </Card>
                    
                    {/* Comments Section */}
                    <Box mt="4">
                      <BlogComments 
                        key={`${post.Id}-${commentRefreshKey}`}
                        blogPostId={post.Id} 
                        handleName={handle.Handle}
                        onCommentAdded={() => {
                          // Refresh comments by updating the key
                          setCommentRefreshKey(prev => prev + 1);
                        }}
                      />
                    </Box>
                  </Box>
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

        {/* Announcements Section */}
        {announcements && announcements.length > 0 && (
          <Card mb="6">
            <Box p="6">
              <Heading size="6" mb="4">
                {t('subscriber_pages.sections.announcements')}
              </Heading>
              <Flex direction="column" gap="4">
                {announcements.map((announcement) => (
                  <Box key={announcement.Id} p="4" style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--radius-3)' }}>
                    <Heading size="4" mb="2">
                      {announcement.Title}
                    </Heading>
                    <Text size="3" mb="3" style={{ whiteSpace: 'pre-wrap' }}>
                      {announcement.Content}
                    </Text>
                    
                    {/* Linked Harbor Content */}
                    {announcement.linkedContent && announcement.linkedContent.length > 0 && (
                      <Box mt="4">
                        <Text size="2" weight="bold" mb="2" color="gray">
                          {t('subscriber_pages.announcements.linked_content_label')}:
                        </Text>
                        <Flex direction="column" gap="2">
                          {announcement.linkedContent.map((content) => (
                            <Card key={content.id} size="1">
                              <Box p="3">
                                <Flex justify="between" align="start" gap="2">
                                  <Box style={{ flex: 1 }}>
                                    <Text size="2" weight="bold">
                                      {content.title}
                                    </Text>
                                    {content.description && (
                                      <Text size="1" color="gray" mb="1">
                                        {content.description}
                                      </Text>
                                    )}
                                    <Flex gap="1" align="center" mb="1">
                                      {content.form && (
                                        <Badge color="blue" size="1">
                                          {content.form}
                                        </Badge>
                                      )}
                                      {content.genre && (
                                        <Badge color="green" size="1">
                                          {content.genre}
                                        </Badge>
                                      )}
                                    </Flex>
                                  </Box>
                                  <Button asChild size="1">
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
                    
                    <Flex gap="2" align="center" mt="3">
                      {announcement.Language && (
                        <Badge color="blue" variant="soft">
                          {announcement.Language.toUpperCase()}
                        </Badge>
                      )}
                      {announcement.PublishedAt && (
                        <Text size="2" color="gray">
                          {new Date(announcement.PublishedAt).toLocaleDateString()}
                        </Text>
                      )}
                      {announcement.ExpiresAt && (
                        <Text size="2" color="gray">
                          {t('subscriber_pages.announcements.expires')}: {new Date(announcement.ExpiresAt).toLocaleDateString()}
                        </Text>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Box>
          </Card>
        )}

        {/* Contact Section */}
        <Card mb="6">
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.contact')}
            </Heading>
            {contactInfo ? (
              <Box>
                <Flex direction="column" gap="3">
                  {contactInfo.Email && (
                    <Flex gap="2" align="center">
                      <Text size="3" weight="bold" style={{ minWidth: '80px' }}>Email:</Text>
                      <Text size="3">{contactInfo.Email}</Text>
                    </Flex>
                  )}
                  {contactInfo.Phone && (
                    <Flex gap="2" align="center">
                      <Text size="3" weight="bold" style={{ minWidth: '80px' }}>Phone:</Text>
                      <Text size="3">{contactInfo.Phone}</Text>
                    </Flex>
                  )}
                  {contactInfo.Website && (
                    <Flex gap="2" align="center">
                      <Text size="3" weight="bold" style={{ minWidth: '80px' }}>Website:</Text>
                      <Text size="3">
                        <a href={contactInfo.Website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-9)' }}>
                          {contactInfo.Website}
                        </a>
                      </Text>
                    </Flex>
                  )}
                  {contactInfo.Location && (
                    <Flex gap="2" align="center">
                      <Text size="3" weight="bold" style={{ minWidth: '80px' }}>Location:</Text>
                      <Text size="3">{contactInfo.Location}</Text>
                    </Flex>
                  )}
                  {contactInfo.SocialLinks && (
                    <Flex gap="2" align="center">
                      <Text size="3" weight="bold" style={{ minWidth: '80px' }}>Social:</Text>
                      <Text size="3">{contactInfo.SocialLinks}</Text>
                    </Flex>
                  )}
                </Flex>
                <Flex gap="2" align="center" mt="4">
                  <Badge color="blue">
                    {contactInfo.Language.toUpperCase()}
                  </Badge>
                  <Text size="2" color="gray">
                    {new Date(contactInfo.UpdatedAt).toLocaleDateString()}
                  </Text>
                </Flex>
              </Box>
            ) : (
              <Text size="3" color="gray">
                {t('subscriber_pages.content.noContent')}
              </Text>
            )}
          </Box>
        </Card>

        {/* Bio Section - Moved to bottom */}
        <Card>
          <Box p="6">
            <Heading size="6" mb="4">
              {t('subscriber_pages.sections.bio')}
            </Heading>
            {biography ? (
              <Box>
                <Text size="3" style={{ whiteSpace: 'pre-wrap' }} mb="3">
                  {biography.Bio}
                </Text>
                <Flex gap="2" align="center">
                  <Badge color="blue">
                    {biography.Language.toUpperCase()}
                  </Badge>
                  <Text size="2" color="gray">
                    {new Date(biography.UpdatedAt).toLocaleDateString()}
                  </Text>
                </Flex>
              </Box>
            ) : (
              <Text size="3" color="gray">
                {t('subscriber_pages.content.noContent')}
              </Text>
            )}
          </Box>
        </Card>
      </Container>
              </Box>
        <Footer />
        
        {/* Subscriber Opt-In Prompt */}
        {showOptIn && session?.user?.email && (
          <Box style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.8)', 
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Box style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: 'var(--radius-3)',
              maxWidth: '600px',
              width: '90%'
            }}>
              <SubscriberOptIn email={session.user.email} />
              <Flex justify="center" mt="3">
                <Button 
                  variant="soft" 
                  onClick={() => {
                    setShowOptIn(false);
                    // Mark that we've shown the opt-in for this user
                    localStorage.setItem(`optInShown_${session.user.email}`, 'true');
                  }}
                >
                  {t('common.skip_subscription')}
                </Button>
              </Flex>
            </Box>
          </Box>
        )}
      </>
    );
  }
